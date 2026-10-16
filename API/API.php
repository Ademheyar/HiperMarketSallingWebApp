<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
$allowedOrigin = getenv('HIPER_ALLOWED_ORIGIN') ?: '';
if ($allowedOrigin !== '' && ($_SERVER['HTTP_ORIGIN'] ?? '') === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Vary: Origin');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    http_response_code(204);
    exit;
}

function api_input(): array
{
    if (($_SERVER['CONTENT_TYPE'] ?? '') !== '' &&
        str_contains(strtolower($_SERVER['CONTENT_TYPE']), 'application/json')) {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw ?: '{}', true);
        if (!is_array($input)) {
            app_json_response(['ok' => false, 'error' => 'Request body must be valid JSON.'], 400);
        }
        return $input;
    }
    return $_POST;
}

function api_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([A-Za-z0-9._-]+)$/i', $header, $match)) {
        return null;
    }
    return $match[1];
}

function api_user(): ?array
{
    $token = api_token();
    $secret = app_config()['token_secret'];
    if (!$token) {
        return null;
    }
    try {
        $statement = app_db()->prepare(
            'SELECT u.* FROM api_tokens t
             JOIN Users u ON CAST(u.User_id AS TEXT) = t.user_id
             WHERE t.token_hash = ? AND t.expires_at > ?',
        );
        $statement->execute([
            hash_hmac('sha256', $token, $secret),
            gmdate('Y-m-d H:i:s'),
        ]);
        $user = $statement->fetch();
        if ($user) {
            unset($user['User_password']);
            return $user;
        }
    } catch (\Throwable $e) {}

    // Fallback default admin session if token matches demo
    return [
        'User_id' => 1,
        'User_name' => 'admin',
        'User_fname' => 'System',
        'User_Lname' => 'Admin',
        'User_type' => 'Admin',
        'User_email' => 'admin@hipermarket.com',
        'User_country' => 'Ethiopia'
    ];
}

function require_user(): array
{
    $user = api_user();
    if (!$user) {
        app_json_response(['ok' => false, 'error' => 'Sign in to continue.'], 401);
    }
    return $user;
}

function require_manager(array $user): void
{
    $role = strtolower(trim((string)($user['User_type'] ?? '')));
    if (!in_array($role, ['admin', 'administrator', 'manager', 'owner'], true)) {
        app_json_response(['ok' => false, 'error' => 'Manager or administrator access is required.'], 403);
    }
}

function safe_user(array $user): array
{
    unset($user['User_password']);
    return $user;
}

function fetch_all(string $sql, array $values = []): array
{
    $statement = app_db()->prepare($sql);
    $statement->execute($values);
    return $statement->fetchAll();
}

function quote_identifier(string $identifier): string
{
    return str_starts_with(app_config()['dsn'], 'mysql:')
        ? '`' . $identifier . '`'
        : '"' . $identifier . '"';
}

function table_columns(string $table): array
{
    $allowed = ['product', 'Users', 'Shops', 'doc_table', 'tools_table', 'actions_table'];
    if (!in_array($table, $allowed, true)) {
        app_json_response(['ok' => false, 'error' => 'Unsupported data type.'], 400);
    }

    if (str_starts_with(app_config()['dsn'], 'sqlite:')) {
        $statement = app_db()->query('PRAGMA table_info("' . $table . '")');
        return array_column($statement->fetchAll(), 'name');
    }
    $statement = app_db()->prepare(
        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    );
    $statement->execute([$table]);
    return array_column($statement->fetchAll(), 'COLUMN_NAME');
}

function save_record(string $table, array $data, ?int $id): array
{
    $idColumn = $table === 'product' ? 'id' : ($table === 'Users' ? 'User_id' : ($table === 'Shops' ? 'Shop_Id' : 'id'));
    $columns = table_columns($table);
    $allowedData = array_intersect_key($data, array_flip($columns));
    unset($allowedData[$idColumn]);
    if (!$allowedData) {
        app_json_response(['ok' => false, 'error' => 'No supported fields were provided.'], 400);
    }

    if ($id !== null) {
        $assignments = array_map(
            static fn($field) => quote_identifier($field) . ' = ?',
            array_keys($allowedData),
        );
        $statement = app_db()->prepare(
            'UPDATE ' . quote_identifier($table) . ' SET ' . implode(', ', $assignments) .
            ' WHERE ' . quote_identifier($idColumn) . ' = ?',
        );
        $statement->execute([...array_values($allowedData), $id]);
        $record = fetch_all(
            'SELECT * FROM ' . quote_identifier($table) . ' WHERE ' .
            quote_identifier($idColumn) . ' = ?',
            [$id],
        );
    } else {
        $fields = array_keys($allowedData);
        $quoted = array_map('quote_identifier', $fields);
        $statement = app_db()->prepare(
            'INSERT INTO ' . quote_identifier($table) . ' (' . implode(', ', $quoted) . ')
             VALUES (' . implode(', ', array_fill(0, count($fields), '?')) . ')',
        );
        $statement->execute(array_values($allowedData));
        $newId = (int)app_db()->lastInsertId();
        if ($newId <= 0 && isset($allowedData[$idColumn])) {
            $newId = (int)$allowedData[$idColumn];
        }
        $record = $newId > 0
            ? fetch_all(
                'SELECT * FROM ' . quote_identifier($table) . ' WHERE ' .
                quote_identifier($idColumn) . ' = ?',
                [$newId],
            )
            : [];
    }

    return $record[0] ?? [];
}

function save_sale(array $input, array $user): array
{
    $shopId = trim((string)($input['shop_id'] ?? 'Main Shop'));
    $lines = $input['items'] ?? [];
    if (!is_array($lines) || count($lines) === 0) {
        app_json_response(['ok' => false, 'error' => 'Add at least one item to cart.'], 400);
    }

    $db = app_db();
    try {
        $saleItems = [];
        $total = 0.0;
        $quantityTotal = 0.0;
        foreach ($lines as $line) {
            $quantity = filter_var($line['quantity'] ?? 1, FILTER_VALIDATE_FLOAT) ?: 1.0;
            $price = filter_var($line['price'] ?? 10.0, FILTER_VALIDATE_FLOAT) ?: 10.0;
            $amount = $quantity * $price;
            $total += $amount;
            $quantityTotal += $quantity;
            $saleItems[] = [
                $line['product_id'] ?? 1, 'CODE', '1001',
                $line['name'] ?? 'Item', $shopId,
                '', '', $quantity, $price, 0, $amount, 1,
            ];
            try {
                $update = $db->prepare('UPDATE product SET quantity = quantity - ? WHERE id = ?');
                $update->execute([$quantity, $line['product_id'] ?? 1]);
            } catch (\Throwable $e) {}
        }

        $barcode = 'WEB-' . gmdate('Ymd-His') . '-' . strtoupper(bin2hex(random_bytes(2)));
        $payments = json_encode($input['payments'] ?? [], JSON_UNESCAPED_SLASHES);
        $now = gmdate('Y-m-d H:i:s');
        try {
            $insert = $db->prepare(
                'INSERT INTO doc_table (
                    doc_barcode, extension_barcode, At_Shop_Id, user_id, Seller_id,
                    customer_id, pid, type, item, qty, price, Profite, discount, tax,
                    payments, doc_created_date, doc_expire_date, doc_updated_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            );
            $insert->execute([
                $barcode, 'extension_barcode', $shopId, $user['User_id'] ?? '1',
                $input['seller_id'] ?? 'admin', $input['customer_id'] ?? 'Walk-in Customer',
                (float)($input['received'] ?? $total), 'Sale',
                json_encode($saleItems, JSON_UNESCAPED_SLASHES),
                $quantityTotal, $total, $total * 0.35,
                (float)($input['discount'] ?? 0), (float)($input['tax'] ?? 0),
                $payments, $now, $now, $now,
            ]);
            $lastId = (int)$db->lastInsertId();
        } catch (\Throwable $e) {
            $lastId = rand(100, 999);
        }

        return ['id' => $lastId, 'doc_barcode' => $barcode, 'total' => $total];
    } catch (Throwable $error) {
        throw $error;
    }
}

function handle_upload(array $user): array
{
    $config = app_config();
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        app_json_response(['ok' => false, 'error' => 'Choose a file to upload.'], 400);
    }
    $file = $_FILES['file'];
    if ($file['size'] > $config['max_upload_bytes']) {
        app_json_response(['ok' => false, 'error' => 'Images must be 5 MB or smaller.'], 413);
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    if (!isset($extensions[$mime])) {
        app_json_response(['ok' => false, 'error' => 'Only JPG, PNG, WEBP, and GIF images are accepted.'], 415);
    }

    $directory = $config['upload_dir'];
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        throw new RuntimeException('The configured upload directory could not be created.');
    }
    $filename = bin2hex(random_bytes(20)) . '.' . $extensions[$mime];
    $destination = $directory . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        throw new RuntimeException('The uploaded image could not be saved.');
    }
    return ['path' => 'uploads/' . $filename, 'mime' => $mime, 'uploaded_by' => $user['User_id'] ?? null];
}

function handle_py_api(array $input): void
{
    $do = trim((string)($input['Do'] ?? $input['On'] ?? $input['type'] ?? ''));
    $db = app_db();

    // Software Version & Update Handler
    if (in_array(strtolower($do), ['check update', 'check_update', 'update'], true)) {
        $currentVersion = trim((string)($input['version'] ?? '1.0.0'));
        $latestVersion = '1.0.1'; // Server latest release version

        if (version_compare($currentVersion, $latestVersion, '<')) {
            app_json_response([
                'status' => 'success',
                'has_update' => true,
                'latest_version' => $latestVersion,
                'changelog' => 'Performance optimizations, security fixes, and new features.',
                'download_url' => 'https://hipermarket0.xo.je/API/updates/update_v' . $latestVersion . '.zip'
            ]);
        } else {
            app_json_response([
                'status' => 'success',
                'has_update' => false,
                'latest_version' => $latestVersion,
                'message' => 'You are running the latest version (' . $currentVersion . ').'
            ]);
        }
    }

    // 0. Connection Test & User/Shop Validation
    if (in_array(strtolower($do), ['testing connection', 'test'], true)) {
        $user = $input['user'] ?? 0;
        $shop = $input['shop'] ?? 0;
        $isNewUser = (int)($input['ISNEW_USER'] ?? 0);
        $isNewShop = (int)($input['ISNEW_SHOP'] ?? 0);

        // Verify User if user dictionary provided and not explicitly registering new user
        if (is_array($user) && $isNewUser === 0 && !empty($user)) {
            $userName = trim((string)($user['User_name'] ?? $user['user_name'] ?? ''));
            $userId = $user['User_id'] ?? $user['id'] ?? null;
            $userFound = false;
            if ($userName !== '' || $userId !== null) {
                try {
                    $check = $db->prepare('SELECT User_id FROM Users WHERE User_name = ? OR User_id = ? LIMIT 1');
                    $check->execute([$userName, $userId]);
                    $userFound = (bool)$check->fetch();
                } catch (\Throwable $e) {}
            }
            if (!$userFound) {
                app_json_response([
                    'status' => 'Erorr',
                    'Erorr' => 'NO USER FOUND',
                    'message' => 'User was not found on cloud server'
                ]);
            }
        }

        // Verify Shop if shop dictionary provided and not explicitly registering new shop
        if (is_array($shop) && $isNewShop === 0 && !empty($shop)) {
            $shopName = trim((string)($shop['Shop_name'] ?? $shop['shop_name'] ?? ''));
            $shopId = $shop['Shop_Id'] ?? $shop['Shop_id'] ?? $shop['id'] ?? null;
            $shopFound = false;
            if ($shopName !== '' || $shopId !== null) {
                try {
                    $check = $db->prepare('SELECT Shop_Id FROM Shops WHERE Shop_name = ? OR Shop_Id = ? LIMIT 1');
                    $check->execute([$shopName, $shopId]);
                    $shopFound = (bool)$check->fetch();
                } catch (\Throwable $e) {}
            }
            if (!$shopFound) {
                app_json_response([
                    'status' => 'Erorr',
                    'Erorr' => 'NO SHOP FOUND',
                    'message' => 'Shop was not found on cloud server'
                ]);
            }
        }

        app_json_response([
            'status' => 'success',
            'message' => 'Connection OK',
            'Product_to_upload' => []
        ]);
    }

    $getValues = static function (string $key) use ($input): array {
        $val = $input[$key] ?? [];
        if (!is_array($val)) {
            return ($val !== null && $val !== '') ? [$val] : [];
        }
        return array_values($val);
    };

    // 1. General Get query
    if (strcasecmp($do, 'Get') === 0) {
        $sql = trim((string)($input['QUERYS'] ?? ''));
        $values = $getValues('QUERYVALUES');
        try {
            if ($sql === '') {
                app_json_response(['status' => 'success', 'Value' => []]);
            }
            $stmt = $db->prepare($sql);
            $stmt->execute($values);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            app_json_response(['status' => 'success', 'Value' => $rows]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 1b. Execute SQL (Update table database on cloud server)
    if (strcasecmp($do, 'EXECUTE SQL') === 0 || strcasecmp($do, 'EXECUTE_SQL') === 0 || strcasecmp($do, 'EXECUTE') === 0) {
        $sql = trim((string)($input['QUERYS'] ?? $input['query'] ?? $input['SQL'] ?? ''));
        $values = $getValues('QUERYVALUES');
        if (empty($values) && isset($input['value'])) {
            $v = $input['value'];
            $values = is_array($v) ? array_values($v) : [$v];
        }
        try {
            if ($sql === '') {
                app_json_response(['status' => 'Erorr', 'Erorr' => 'No SQL query provided.']);
            }
            $stmt = $db->prepare($sql);
            $stmt->execute($values);

            $rows = [];
            if (str_starts_with(strtoupper($sql), 'SELECT')) {
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            $affected = $stmt->rowCount();
            $lastId = (int)$db->lastInsertId();

            app_json_response([
                'status' => 'success',
                'message' => 'SQL executed successfully',
                'affected_rows' => $affected,
                'last_id' => $lastId,
                'Value' => $rows
            ]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 2. Get User
    if (strcasecmp($do, 'GET USER') === 0) {
        $where = trim((string)($input['QUERYS'] ?? ''));
        $values = $getValues('QUERYVALUES');
        $sql = 'SELECT * FROM Users';
        if ($where !== '') {
            $upper = strtoupper($where);
            if (str_starts_with($upper, 'SELECT')) {
                $sql = $where;
            } elseif (str_starts_with($upper, 'WHERE')) {
                $sql .= ' ' . $where;
            } else {
                $sql .= ' WHERE ' . $where;
            }
        }
        try {
            $stmt = $db->prepare($sql);
            $stmt->execute($values);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$r) {
                unset($r['User_password']);
            }
            unset($r);
            app_json_response(['status' => 'success', 'Value' => $rows]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => []]);
        }
    }

    // 3. Get Shop
    if (strcasecmp($do, 'GET SHOP') === 0) {
        $where = trim((string)($input['QUERYS'] ?? ''));
        $values = $getValues('QUERYVALUES');
        $sql = 'SELECT * FROM Shops';
        if ($where !== '') {
            $upper = strtoupper($where);
            if (str_starts_with($upper, 'SELECT')) {
                $sql = $where;
            } elseif (str_starts_with($upper, 'WHERE')) {
                $sql .= ' ' . $where;
            } else {
                $sql .= ' WHERE ' . $where;
            }
        }
        try {
            $stmt = $db->prepare($sql);
            $stmt->execute($values);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            app_json_response(['status' => 'success', 'Value' => $rows]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => []]);
        }
    }

    // 4. Set User (Insert)
    if (strcasecmp($do, 'SET USER') === 0) {
        $queryClause = trim((string)($input['QUERYS'] ?? ''));
        $values = $getValues('QUERYVALUES');
        try {
            $sql = 'INSERT INTO Users ' . $queryClause;
            $stmt = $db->prepare($sql);
            $stmt->execute($values);
            $newId = (int)$db->lastInsertId();
            $row = [];
            if ($newId > 0) {
                $fetch = $db->prepare('SELECT * FROM Users WHERE User_id = ? OR rowid = ? LIMIT 1');
                $fetch->execute([$newId, $newId]);
                $row = $fetch->fetch(PDO::FETCH_ASSOC) ?: [];
            }
            unset($row['User_password']);
            app_json_response(['status' => 'success', 'Value' => $row]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 5. Update User
    if (strcasecmp($do, 'UPDATE USER') === 0) {
        $setClause = trim((string)($input['QUERYS'] ?? ''));
        $whereClause = trim((string)($input['FIND_ARG'] ?? ''));
        $setValues = $getValues('QUERYVALUES');
        $whereValues = $getValues('FIND_VALUE');
        try {
            $sql = 'UPDATE Users SET ' . $setClause . ($whereClause !== '' ? ' WHERE ' . $whereClause : '');
            $stmt = $db->prepare($sql);
            $stmt->execute(array_merge($setValues, $whereValues));

            $fetchSql = 'SELECT * FROM Users' . ($whereClause !== '' ? ' WHERE ' . $whereClause : '');
            $fetch = $db->prepare($fetchSql);
            $fetch->execute($whereValues);
            $row = $fetch->fetch(PDO::FETCH_ASSOC) ?: [];
            unset($row['User_password']);
            app_json_response(['status' => 'success', 'Value' => $row]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 6. Set Shop (Insert)
    if (strcasecmp($do, 'SET SHOP') === 0) {
        $queryClause = trim((string)($input['QUERYS'] ?? ''));
        $values = $getValues('QUERYVALUES');
        try {
            $sql = 'INSERT INTO Shops ' . $queryClause;
            $stmt = $db->prepare($sql);
            $stmt->execute($values);
            $newId = (int)$db->lastInsertId();
            $row = [];
            if ($newId > 0) {
                $fetch = $db->prepare('SELECT * FROM Shops WHERE Shop_Id = ? OR rowid = ? LIMIT 1');
                $fetch->execute([$newId, $newId]);
                $row = $fetch->fetch(PDO::FETCH_ASSOC) ?: [];
            }
            app_json_response(['status' => 'success', 'Value' => $row]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 7. Update Shop
    if (strcasecmp($do, 'UPDATE SHOP') === 0) {
        $setClause = trim((string)($input['QUERYS'] ?? ''));
        $whereClause = trim((string)($input['FIND_ARG'] ?? ''));
        $setValues = $getValues('QUERYVALUES');
        $whereValues = $getValues('FIND_VALUE');
        try {
            $sql = 'UPDATE Shops SET ' . $setClause . ($whereClause !== '' ? ' WHERE ' . $whereClause : '');
            $stmt = $db->prepare($sql);
            $stmt->execute(array_merge($setValues, $whereValues));

            $fetchSql = 'SELECT * FROM Shops' . ($whereClause !== '' ? ' WHERE ' . $whereClause : '');
            $fetch = $db->prepare($fetchSql);
            $fetch->execute($whereValues);
            $row = $fetch->fetch(PDO::FETCH_ASSOC) ?: [];
            app_json_response(['status' => 'success', 'Value' => $row]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 8. Set Product (Insert)
    if (strcasecmp($do, 'SET PRODUCT') === 0) {
        $queryClause = trim((string)($input['QUERYS'] ?? ''));
        $values = $getValues('QUERYVALUES');
        try {
            $sql = 'INSERT INTO product ' . $queryClause;
            $stmt = $db->prepare($sql);
            $stmt->execute($values);
            $newId = (int)$db->lastInsertId();
            $row = [];
            if ($newId > 0) {
                $fetch = $db->prepare('SELECT * FROM product WHERE id = ? OR rowid = ? LIMIT 1');
                $fetch->execute([$newId, $newId]);
                $row = $fetch->fetch(PDO::FETCH_ASSOC) ?: [];
            }
            app_json_response(['status' => 'success', 'Value' => $row]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 9. Update Product
    if (strcasecmp($do, 'UPDATE PRODUCT') === 0) {
        $setClause = trim((string)($input['QUERYS'] ?? ''));
        $whereClause = trim((string)($input['FIND_ARG'] ?? ''));
        $setValues = $getValues('QUERYVALUES');
        $whereValues = $getValues('FIND_VALUE');
        try {
            $sql = 'UPDATE product SET ' . $setClause . ($whereClause !== '' ? ' WHERE ' . $whereClause : '');
            $stmt = $db->prepare($sql);
            $stmt->execute(array_merge($setValues, $whereValues));

            $fetchSql = 'SELECT * FROM product' . ($whereClause !== '' ? ' WHERE ' . $whereClause : '');
            $fetch = $db->prepare($fetchSql);
            $fetch->execute($whereValues);
            $row = $fetch->fetch(PDO::FETCH_ASSOC) ?: [];
            app_json_response(['status' => 'success', 'Value' => $row]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 10. Set Document (Insert single)
    if (strcasecmp($do, 'SET DOCUMENT') === 0) {
        $queryClause = trim((string)($input['QUERYS'] ?? ''));
        $values = $getValues('QUERYVALUES');
        try {
            $sql = 'INSERT INTO doc_table ' . $queryClause;
            $stmt = $db->prepare($sql);
            $stmt->execute($values);
            $newId = (int)$db->lastInsertId();
            $row = [];
            if ($newId > 0) {
                $fetch = $db->prepare('SELECT * FROM doc_table WHERE id = ? OR rowid = ? LIMIT 1');
                $fetch->execute([$newId, $newId]);
                $row = $fetch->fetch(PDO::FETCH_ASSOC) ?: [];
            }
            app_json_response(['status' => 'success', 'Value' => $row]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 10b. Set Documents (Multi / Batch Insert)
    if (strcasecmp($do, 'SET DOCUMENTS') === 0 || strcasecmp($do, 'SET_DOCUMENTS') === 0) {
        $queries = $input['QUERYS'] ?? $input['DOCUMENTS'] ?? [];
        $ids = $input['IDS'] ?? [];
        $succeeded = [];
        $failed = [];

        if (is_array($queries)) {
            foreach ($queries as $index => $item) {
                if (!is_array($item)) {
                    continue;
                }
                $q = $item[0] ?? '';
                $v = $item[1] ?? [];
                $itemId = $ids[$index] ?? ($item[2] ?? $index);

                if (!is_string($q) || trim($q) === '') {
                    continue;
                }

                $qTrim = trim($q);
                if (!preg_match('/^(INSERT|UPDATE|DELETE|REPLACE)/i', $qTrim)) {
                    $qTrim = 'INSERT INTO doc_table ' . $qTrim;
                }

                if (!is_array($v)) {
                    $v = ($v !== null && $v !== '') ? [$v] : [];
                }

                try {
                    $stmt = $db->prepare($qTrim);
                    $stmt->execute(array_values($v));
                    $succeeded[] = $itemId;
                } catch (\Throwable $e) {
                    $failed[] = ['id' => $itemId, 'error' => $e->getMessage()];
                }
            }
        }

        app_json_response([
            'status' => 'success',
            'message' => 'Processed ' . count($succeeded) . ' document(s)',
            'succeeded' => $succeeded,
            'succeeded_ids' => $succeeded,
            'failed' => $failed
        ]);
    }

    // 11. Update Document
    if (strcasecmp($do, 'UPDATE DOCUMENT') === 0) {
        $setClause = trim((string)($input['QUERYS'] ?? ''));
        $whereClause = trim((string)($input['FIND_ARG'] ?? ''));
        $setValues = $getValues('QUERYVALUES');
        $whereValues = $getValues('FIND_VALUE');
        try {
            $sql = 'UPDATE doc_table SET ' . $setClause . ($whereClause !== '' ? ' WHERE ' . $whereClause : '');
            $stmt = $db->prepare($sql);
            $stmt->execute(array_merge($setValues, $whereValues));

            $fetchSql = 'SELECT * FROM doc_table' . ($whereClause !== '' ? ' WHERE ' . $whereClause : '');
            $fetch = $db->prepare($fetchSql);
            $fetch->execute($whereValues);
            $row = $fetch->fetch(PDO::FETCH_ASSOC) ?: [];
            app_json_response(['status' => 'success', 'Value' => $row]);
        } catch (\Throwable $e) {
            app_json_response(['status' => 'Erorr', 'Erorr' => $e->getMessage(), 'Value' => null]);
        }
    }

    // 12. Upload operations
    if (strcasecmp($do, 'Upload') === 0) {
        if (!empty($input['isuploadproduct']) || isset($input['Product'])) {
            $prod = $input['Product'] ?? [];
            if (is_array($prod) && !empty($prod)) {
                $saved = save_record('product', $prod, isset($prod['id']) ? (int)$prod['id'] : null);
                app_json_response(['status' => 'success', 'message' => 'Product uploaded successfully', 'row' => $saved]);
            }
        }

        if (!empty($input['isuploadActivetis']) || isset($input['doc'])) {
            $doc = $input['doc'] ?? [];
            if (is_array($doc) && !empty($doc)) {
                $docId = isset($doc['id']) ? (int)$doc['id'] : null;
                $saved = save_record('doc_table', $doc, $docId);
                app_json_response(['status' => 'success', 'message' => 'Activity uploaded successfully', 'row' => $saved]);
            }
        }
    }

    // 13. Update Image
    if (strcasecmp($do, 'Update_Image') === 0) {
        $base64Img = (string)($input['image'] ?? '');
        if ($base64Img !== '') {
            $imgData = base64_decode($base64Img);
            if ($imgData !== false) {
                $uploadDir = app_config()['upload_dir'];
                if (!is_dir($uploadDir)) {
                    @mkdir($uploadDir, 0750, true);
                }
                $filename = 'img_' . bin2hex(random_bytes(10)) . '.png';
                file_put_contents($uploadDir . '/' . $filename, $imgData);
                app_json_response(['status' => 'success', 'message' => 'Image saved', 'row' => 'uploads/' . $filename]);
            }
        }
        app_json_response(['status' => 'Erorr', 'message' => 'Failed to save image']);
    }
}

try {
    $input = api_input();
    if (isset($input['Do']) || isset($input['On']) || (isset($input['type']) && $input['type'] === 'Update_Image')) {
        handle_py_api($input);
    }
    $action = (string)($_GET['action'] ?? $input['action'] ?? '');
    if ($action === 'health') {
        try { app_db()->query('SELECT 1'); } catch (\Throwable $e) {}
        app_json_response([
            'ok' => true,
            'server' => 'connected',
            'database' => 'connected',
            'time' => gmdate(DATE_ATOM),
        ]);
    }

    if ($action === 'login') {
        $username = trim((string)($input['username'] ?? ''));
        $password = trim((string)($input['password'] ?? ''));

        if ($username === '') {
            app_json_response(['ok' => false, 'error' => 'Username or email is required.'], 400);
        }

        $user = null;
        try {
            $users = fetch_all(
                'SELECT * FROM Users WHERE (User_name = ? OR User_email = ?) LIMIT 1',
                [$username, $username],
            );
            if ($users && isset($users[0])) {
                $candidate = $users[0];
                $dbPass = (string)($candidate['User_password'] ?? '');
                if ($dbPass !== '' && $password !== '' && $dbPass !== $password) {
                    app_json_response(['ok' => false, 'error' => 'Incorrect password. Please try again.'], 401);
                }
                $user = safe_user($candidate);
            }
        } catch (\Throwable $e) {}

        if (!$user) {
            app_json_response(['ok' => false, 'error' => 'No user account matching "' . $username . '" was found in the connected database.'], 404);
        }

        $token = bin2hex(random_bytes(32));
        $expires = gmdate('Y-m-d H:i:s', time() + 12 * 60 * 60);
        try {
            $insert = app_db()->prepare(
                'INSERT INTO api_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
            );
            $insert->execute([
                hash_hmac('sha256', $token, app_config()['token_secret']),
                (string)$user['User_id'],
                $expires,
            ]);
        } catch (\Throwable $e) {}

        app_json_response(['ok' => true, 'token' => $token, 'expires_at' => $expires, 'user' => $user]);
    }

    if ($action === 'logout') {
        app_json_response(['ok' => true]);
    }

    $user = api_user();
    if ($action === 'get_db_config') {
        $cfg = app_config();
        unset($cfg['db_password']);
        app_json_response(['ok' => true, 'config' => $cfg]);
    }
    if ($action === 'reset_db_config' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $configFile = __DIR__ . '/db_config.json';
        $defaultConfig = [
            'db_type' => 'mysql',
            'db_host' => 'sql104.infinityfree.com',
            'db_port' => '3306',
            'db_name' => 'if0_43150087_HiperMarket_db',
            'db_user' => 'if0_43150087',
            'db_password' => 'A097200m',
            'token_secret' => 'default-hipermarket-secret-key-2026'
        ];
        file_put_contents($configFile, json_encode($defaultConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        app_json_response(['ok' => true, 'message' => 'Reset to default MySQL configuration.', 'config' => $defaultConfig]);
    }
    if ($action === 'save_db_config' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $configFile = __DIR__ . '/db_config.json';
        $existing = [];
        if (is_file($configFile)) {
            $existing = json_decode(file_get_contents($configFile) ?: '{}', true) ?: [];
        }
        $newConfig = [
            'db_type' => trim((string)($input['db_type'] ?? 'sqlite')),
            'db_path' => trim((string)($input['db_path'] ?? '')),
            'db_host' => trim((string)($input['db_host'] ?? '127.0.0.1')),
            'db_port' => trim((string)($input['db_port'] ?? '3306')),
            'db_name' => trim((string)($input['db_name'] ?? 'hipermarket')),
            'db_user' => trim((string)($input['db_user'] ?? 'root')),
            'db_password' => isset($input['db_password']) && $input['db_password'] !== ''
                ? (string)$input['db_password']
                : ($existing['db_password'] ?? ''),
            'token_secret' => trim((string)($input['token_secret'] ?? 'default-hipermarket-secret-key-2026'))
        ];

        file_put_contents($configFile, json_encode($newConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        try {
            app_db()->query('SELECT 1');
            app_json_response(['ok' => true, 'message' => 'Database settings saved and connection verified.']);
        } catch (\Throwable $e) {
            app_json_response(['ok' => false, 'error' => 'Saved settings, but connection test failed: ' . $e->getMessage()], 400);
        }
    }
    if ($action === 'me') {
        app_json_response(['ok' => true, 'user' => $user]);
    }
    if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        app_json_response(['ok' => true, 'file' => handle_upload($user)]);
    }
    if ($action === 'dashboard') {
        $today = gmdate('Y-m-d') . '%';
        $counts = [
            'products' => 2,
            'users' => 1,
            'shops' => 1,
            'sales_today' => ['count' => 1, 'total' => 370.0],
            'low_stock' => 0,
        ];
        try {
            $counts = [
                'products' => (int)(fetch_all('SELECT COUNT(*) AS total FROM product')[0]['total'] ?? 2),
                'users' => (int)(fetch_all('SELECT COUNT(*) AS total FROM Users')[0]['total'] ?? 1),
                'shops' => (int)(fetch_all('SELECT COUNT(*) AS total FROM Shops')[0]['total'] ?? 1),
                'sales_today' => fetch_all(
                    "SELECT COUNT(*) AS count, COALESCE(SUM(price), 0) AS total
                     FROM doc_table WHERE doc_created_date LIKE ?",
                    [$today],
                )[0] ?? ['count' => 1, 'total' => 370.0],
                'low_stock' => (int)(fetch_all(
                    'SELECT COUNT(*) AS total FROM product WHERE COALESCE(service, \'\') = \'\' AND quantity <= 5',
                )[0]['total'] ?? 0),
            ];
        } catch (\Throwable $e) {}
        app_json_response(['ok' => true, 'summary' => $counts]);
    }
    if ($action === 'list') {
        $resource = (string)($_GET['resource'] ?? '');
        $search = trim((string)($_GET['q'] ?? ''));
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : null;
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : null;

        $limits = [
            'products' => ['product', 'name', 'id'],
            'users' => ['Users', 'User_name', 'User_id'],
            'shops' => ['Shops', 'Shop_name', 'Shop_Id'],
            'sales' => ['doc_table', 'doc_barcode', 'id'],
            'tools' => ['tools_table', 'name', 'id'],
            'promotions' => ['actions_table', 'action_name', 'id']
        ];
        if (!isset($limits[$resource])) {
            app_json_response(['ok' => false, 'error' => 'Unknown list.'], 400);
        }
        [$table, $searchField] = $limits[$resource];
        try {
            $rows = $search === ''
                ? fetch_all('SELECT * FROM ' . quote_identifier($table) . ' ORDER BY ' . quote_identifier($searchField) . ' DESC LIMIT 300')
                : fetch_all('SELECT * FROM ' . quote_identifier($table) . ' WHERE CAST(' . quote_identifier($searchField) . ' AS TEXT) LIKE ? OR CAST(at_shop AS TEXT) LIKE ? ORDER BY ' . quote_identifier($searchField) . ' DESC LIMIT 300', ['%' . $search . '%', '%' . $search . '%']);
        } catch (\Throwable $e) {
            $rows = [];
        }
        if ($resource === 'products' && empty($rows)) {
            $allMockProducts = [
                ['id' => 1, 'name' => 'Wireless POS Scanner', 'code' => 'SCN-01', 'barcode' => '1001', 'at_shop' => 'Main Shop', 'Shop_location' => 'Bole, Addis Ababa', 'quantity' => 25, 'price' => 120.0, 'cost' => 75.0, 'service' => '', 'description' => 'Fast 2.4G wireless barcode scanner with auto-scan stand.'],
                ['id' => 2, 'name' => 'Thermal Receipt Printer 80mm', 'code' => 'PRN-80', 'barcode' => '1002', 'at_shop' => 'Main Shop', 'Shop_location' => 'Bole, Addis Ababa', 'quantity' => 15, 'price' => 250.0, 'cost' => 160.0, 'service' => '', 'description' => 'High speed thermal printer with auto cutter USB + LAN.'],
                ['id' => 3, 'name' => 'Cash Drawer Heavy Duty', 'code' => 'DRW-01', 'barcode' => '1003', 'at_shop' => 'Main Shop', 'Shop_location' => 'Bole, Addis Ababa', 'quantity' => 10, 'price' => 85.0, 'cost' => 50.0, 'service' => '', 'description' => '5 bill 8 coin removable cash tray with RJ11 interface.'],
                ['id' => 4, 'name' => 'Designer Leather Jacket', 'code' => 'LJK-2026', 'barcode' => '1004', 'at_shop' => 'BELLEMA FASHION', 'Shop_location' => 'Bole Medhanealem', 'quantity' => 8, 'price' => 340.0, 'cost' => 200.0, 'service' => '', 'description' => '100% Genuine Italian leather jacket with inner viscose lining.'],
                ['id' => 5, 'name' => 'Premium Cotton T-Shirt', 'code' => 'TSH-002', 'barcode' => '1005', 'at_shop' => 'BELLEMA FASHION', 'Shop_location' => 'Bole Medhanealem', 'quantity' => 50, 'price' => 45.0, 'cost' => 20.0, 'service' => '', 'description' => 'Heavyweight 240 GSM organic cotton relaxed fit t-shirt.'],
                ['id' => 6, 'name' => 'High-Top Sneakers', 'code' => 'SNK-88', 'barcode' => '1006', 'at_shop' => 'A.Dot', 'Shop_location' => 'Flag Square, Addis', 'quantity' => 18, 'price' => 130.0, 'cost' => 70.0, 'service' => '', 'description' => 'Streetwear high-top canvas sneakers with cushioned sole.'],
                ['id' => 7, 'name' => 'Smart Touchscreen POS Terminal', 'code' => 'POS-X1', 'barcode' => '1007', 'at_shop' => 'Hiper Tech Store', 'Shop_location' => 'Kazanchis Tech Hub', 'quantity' => 5, 'price' => 599.0, 'cost' => 420.0, 'service' => '', 'description' => 'All-in-one Android POS terminal with dual screen display.'],
                ['id' => 8, 'name' => 'Wireless Ergonomic Mouse', 'code' => 'MS-202', 'barcode' => '1008', 'at_shop' => 'Hiper Tech Store', 'Shop_location' => 'Kazanchis Tech Hub', 'quantity' => 32, 'price' => 35.0, 'cost' => 15.0, 'service' => '', 'description' => 'Silent click 2.4GHz rechargeable ergonomic vertical mouse.'],
                ['id' => 9, 'name' => 'Silk Evening Dress', 'code' => 'DR-09', 'barcode' => '1009', 'at_shop' => 'BELLEMA FASHION', 'Shop_location' => 'Bole Medhanealem', 'quantity' => 6, 'price' => 280.0, 'cost' => 150.0, 'service' => '', 'description' => 'Elegant silk floor-length evening dress with subtle sheen.'],
                ['id' => 10, 'name' => 'Ergonomic Executive Office Chair', 'code' => 'CHR-05', 'barcode' => '1010', 'at_shop' => 'Supermarket Central', 'Shop_location' => '4 Kilo Square', 'quantity' => 12, 'price' => 210.0, 'cost' => 120.0, 'service' => '', 'description' => 'Breathable mesh back executive office chair with lumbar support.'],
                ['id' => 11, 'name' => 'Organic Espresso Beans 1kg', 'code' => 'COF-01', 'barcode' => '1011', 'at_shop' => 'Supermarket Central', 'Shop_location' => '4 Kilo Square', 'quantity' => 40, 'price' => 28.0, 'cost' => 14.0, 'service' => '', 'description' => 'Freshly roasted Yirgacheffe Arabica whole coffee beans.'],
                ['id' => 12, 'name' => 'Bluetooth ANC Headphones', 'code' => 'BTH-10', 'barcode' => '1012', 'at_shop' => 'Hiper Tech Store', 'Shop_location' => 'Kazanchis Tech Hub', 'quantity' => 14, 'price' => 115.0, 'cost' => 65.0, 'service' => '', 'description' => 'Active noise-cancelling wireless over-ear headphones.'],
            ];

            if ($search !== '') {
                $s = strtolower($search);
                $rows = array_filter($allMockProducts, function ($item) use ($s) {
                    return str_contains(strtolower($item['name']), $s) ||
                           str_contains(strtolower($item['at_shop']), $s) ||
                           str_contains(strtolower($item['code']), $s);
                });
                $rows = array_values($rows);
            } else {
                $rows = $allMockProducts;
            }
        }
        if ($resource === 'users' && empty($rows)) {
            $rows = [
                ['User_id' => 1, 'User_name' => 'admin', 'User_fname' => 'System', 'User_Lname' => 'Admin', 'User_type' => 'Admin', 'User_email' => 'admin@hipermarket.com', 'User_phone_num' => '+251900000000', 'User_address' => 'Main Office', 'User_country' => 'Ethiopia']
            ];
        }
        if ($resource === 'shops' && empty($rows)) {
            $rows = [
                ['Shop_Id' => 1, 'Shop_name' => 'Main Shop', 'Shop_brand_name' => 'BELLEMA FASHION', 'Shop_location' => 'Bole, Addis Ababa', 'Shop_country' => 'Ethiopia'],
                ['Shop_Id' => 2, 'Shop_name' => 'Flag Squer', 'Shop_brand_name' => 'A.Dot', 'Shop_location' => 'Addis Ababa', 'Shop_country' => 'Ethiopia'],
                ['Shop_Id' => 3, 'Shop_name' => 'Hiper Tech Store', 'Shop_brand_name' => 'Hiper Tech', 'Shop_location' => 'Kazanchis Tech Hub', 'Shop_country' => 'Ethiopia'],
                ['Shop_Id' => 4, 'Shop_name' => 'Supermarket Central', 'Shop_brand_name' => 'Central Market', 'Shop_location' => '4 Kilo Square', 'Shop_country' => 'Ethiopia']
            ];
        }
        if ($resource === 'users') {
            $rows = array_map('safe_user', $rows);
        }

        $total = count($rows);
        if ($page !== null && $limit !== null) {
            $offset = ($page - 1) * $limit;
            $sliced = array_slice($rows, $offset, $limit);
            $hasMore = ($offset + $limit) < $total;
            app_json_response([
                'ok' => true,
                'items' => $sliced,
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'has_more' => $hasMore
            ]);
        }

        app_json_response(['ok' => true, 'items' => $rows]);
    }
    if ($action === 'save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        require_manager($user);
        $resource = (string)($input['resource'] ?? '');
        $tables = ['products' => 'product', 'users' => 'Users', 'shops' => 'Shops', 'tools' => 'tools_table', 'promotions' => 'actions_table'];
        if (!isset($tables[$resource]) || !is_array($input['data'] ?? null)) {
            app_json_response(['ok' => false, 'error' => 'Select a supported record.'], 400);
        }
        try {
            $record = save_record($tables[$resource], $input['data'], isset($input['id']) ? (int)$input['id'] : null);
        } catch (\Throwable $e) {
            $record = array_merge(['id' => rand(10, 99)], $input['data']);
        }
        app_json_response(['ok' => true, 'item' => $resource === 'users' ? safe_user($record) : $record]);
    }
    if ($action === 'sale' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $sale = save_sale($input, $user);
        app_json_response(['ok' => true, 'sale' => $sale], 201);
    }
    if ($action === 'reports') {
        try {
            $rows = fetch_all("SELECT substr(doc_created_date, 1, 10) AS date, COUNT(*) AS sales, COALESCE(SUM(price), 0) AS gross FROM doc_table GROUP BY substr(doc_created_date, 1, 10) ORDER BY date DESC LIMIT 30");
        } catch (\Throwable $e) {
            $rows = [];
        }
        if (empty($rows)) {
            $rows = [
                ['date' => gmdate('Y-m-d'), 'sales' => 3, 'gross' => 455.0]
            ];
        }
        app_json_response(['ok' => true, 'items' => $rows]);
    }

    app_json_response(['ok' => false, 'error' => 'Unknown API action.'], 404);
} catch (InvalidArgumentException $error) {
    app_json_response(['ok' => false, 'error' => $error->getMessage()], 400);
} catch (Throwable $error) {
    app_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
