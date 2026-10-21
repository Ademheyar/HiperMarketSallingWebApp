<?php
declare(strict_types=1);

function app_config(): array
{
    $root = dirname(__DIR__, 2);
    $configFile = __DIR__ . '/db_config.json';
    $custom = [];
    if (is_file($configFile)) {
        $raw = file_get_contents($configFile);
        $custom = json_decode($raw ?: '{}', true) ?: [];
    }

    $dbType = strtolower(trim((string)($custom['db_type'] ?? 'mysql')));
    $localDbPath = !empty($custom['db_path'])
        ? $custom['db_path']
        : (getenv('HIPER_DB_PATH') ?: $root . '/data/my_database.db');

    if ($dbType === 'sqlite') {
        $dsn = 'sqlite:' . $localDbPath;
        $dbUser = getenv('HIPER_DB_USER') ?: '';
        $dbPassword = getenv('HIPER_DB_PASSWORD') ?: '';
    } else {
        $host = trim((string)($custom['db_host'] ?? getenv('HIPER_DB_HOST') ?: 'sql104.infinityfree.com'));
        $port = trim((string)($custom['db_port'] ?? getenv('HIPER_DB_PORT') ?: '3306'));
        $dbname = trim((string)($custom['db_name'] ?? getenv('HIPER_DB_NAME') ?: 'if0_43150087_HiperMarket_db'));
        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
        $dbUser = $custom['db_user'] ?? getenv('HIPER_DB_USER') ?: 'if0_43150087';
        $dbPassword = $custom['db_password'] ?? getenv('HIPER_DB_PASSWORD') ?: 'A097200m';
    }

    return [
        'db_type' => $dbType,
        'dsn' => $dsn,
        'db_host' => $custom['db_host'] ?? 'sql104.infinityfree.com',
        'db_port' => $custom['db_port'] ?? '3306',
        'db_name' => $custom['db_name'] ?? 'if0_43150087_HiperMarket_db',
        'db_path' => $localDbPath,
        'db_user' => $dbUser,
        'db_password' => $dbPassword,
        'token_secret' => $custom['token_secret'] ?? (getenv('HIPER_TOKEN_SECRET') ?: 'default-hipermarket-secret-key-2026'),
        'upload_dir' => getenv('HIPER_UPLOAD_DIR') ?: dirname(__DIR__) . '/uploads',
        'max_upload_bytes' => 5 * 1024 * 1024,
    ];
}

function app_db(): PDO
{
    static $connection;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $config = app_config();
    $root = dirname(__DIR__, 2);

    // Resolve local fallback DB file path
    $localDbPath = !empty($config['db_path'])
        ? $config['db_path']
        : (getenv('HIPER_DB_PATH') ?: $root . '/data/my_database.db');

    if (!str_contains($localDbPath, ':') && !str_starts_with($localDbPath, '/') && !str_starts_with($localDbPath, '\\')) {
        $localDbPath = $root . '/' . ltrim($localDbPath, './\\');
    }

    try {
        $connection = new PDO(
            $config['dsn'],
            $config['db_user'],
            $config['db_password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ],
        );
        $connection->exec('CREATE TABLE IF NOT EXISTS user_subscriptions (
            user_id VARCHAR(128) PRIMARY KEY,
            plan_id VARCHAR(40) NOT NULL DEFAULT \'free\',
            status VARCHAR(24) NOT NULL DEFAULT \'free\',
            payment_method VARCHAR(40) NOT NULL DEFAULT \'\',
            billing_email VARCHAR(255) NOT NULL DEFAULT \'\',
            paid_at VARCHAR(40) NOT NULL DEFAULT \'\',
            updated_at VARCHAR(40) NOT NULL
        )');
        return $connection;
    } catch (\Throwable $e) {
        // Fallback: If primary MySQL database connection fails, connect to local SQLite database file
        try {
            $dir = dirname($localDbPath);
            if (!is_dir($dir)) {
                @mkdir($dir, 0755, true);
            }
            $connection = new PDO('sqlite:' . $localDbPath, '', '', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $connection->exec('
                CREATE TABLE IF NOT EXISTS Users (User_id INTEGER PRIMARY KEY, User_name TEXT, User_fname TEXT, User_Lname TEXT, User_type TEXT, User_email TEXT, User_password TEXT);
                CREATE TABLE IF NOT EXISTS Shops (Shop_Id INTEGER PRIMARY KEY, Shop_name TEXT, Shop_brand_name TEXT, Shop_currency TEXT NOT NULL DEFAULT "ETB", Shop_Actions TEXT);
                CREATE TABLE IF NOT EXISTS product (id INTEGER PRIMARY KEY, name TEXT, code TEXT, barcode TEXT, at_shop TEXT, quantity REAL, price REAL, cost REAL, service TEXT);
                CREATE TABLE IF NOT EXISTS doc_table (id INTEGER PRIMARY KEY, doc_barcode TEXT, extension_barcode TEXT, At_Shop_Id TEXT, user_id TEXT, Seller_id TEXT, customer_id TEXT, pid REAL, type TEXT, item TEXT, qty REAL, price REAL, Profite REAL, discount REAL, tax REAL, payments TEXT, doc_created_date TEXT, doc_expire_date TEXT, doc_updated_date TEXT);
                CREATE TABLE IF NOT EXISTS user_subscriptions (user_id TEXT PRIMARY KEY, plan_id TEXT NOT NULL DEFAULT "free", status TEXT NOT NULL DEFAULT "free", payment_method TEXT NOT NULL DEFAULT "", billing_email TEXT NOT NULL DEFAULT "", paid_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL);
            ');
            $shopColumns = array_column($connection->query('PRAGMA table_info("Shops")')->fetchAll(), 'name');
            if (!in_array('Shop_currency', $shopColumns, true)) $connection->exec('ALTER TABLE Shops ADD COLUMN Shop_currency TEXT NOT NULL DEFAULT "$"');
            $countStmt = $connection->query('SELECT COUNT(*) AS c FROM Users');
            if (strtolower((string)$config['db_type']) === 'sqlite' && (int)$countStmt->fetchColumn() === 0) {
                $connection->exec('INSERT INTO Users (User_id, User_name, User_fname, User_Lname, User_type, User_email, User_password) VALUES (1, "admin", "System", "Admin", "Admin", "admin@hipermarket.com", "admin")');
            }

            return $connection;
        } catch (\Throwable $fallbackErr) {
            // Memory fallback if disk file cannot be created
            $connection = new PDO('sqlite::memory:', '', '', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $connection->exec('
                CREATE TABLE IF NOT EXISTS Users (User_id INTEGER PRIMARY KEY, User_name TEXT, User_fname TEXT, User_Lname TEXT, User_type TEXT, User_email TEXT, User_password TEXT);
                INSERT INTO Users (User_id, User_name, User_fname, User_Lname, User_type, User_email, User_password) VALUES (1, "admin", "System", "Admin", "Admin", "admin@hipermarket.com", "admin");
                CREATE TABLE IF NOT EXISTS Shops (Shop_Id INTEGER PRIMARY KEY, Shop_name TEXT, Shop_brand_name TEXT, Shop_currency TEXT NOT NULL DEFAULT "ETB", Shop_Actions TEXT);
                INSERT INTO Shops (Shop_Id, Shop_name, Shop_brand_name) VALUES (1, "Main Shop", "BELLEMA FASHION");
                CREATE TABLE IF NOT EXISTS product (id INTEGER PRIMARY KEY, name TEXT, code TEXT, barcode TEXT, at_shop TEXT, quantity REAL, price REAL, cost REAL, service TEXT);
                INSERT INTO product (id, name, code, barcode, at_shop, quantity, price, cost) VALUES (1, "Wireless POS Scanner", "SCN-01", "1001", "Main Shop", 25, 120.0, 75.0);
                INSERT INTO product (id, name, code, barcode, at_shop, quantity, price, cost) VALUES (2, "Thermal Receipt Printer 80mm", "PRN-80", "1002", "Main Shop", 15, 250.0, 160.0);
                CREATE TABLE IF NOT EXISTS doc_table (id INTEGER PRIMARY KEY, doc_barcode TEXT, extension_barcode TEXT, At_Shop_Id TEXT, user_id TEXT, Seller_id TEXT, customer_id TEXT, pid REAL, type TEXT, item TEXT, qty REAL, price REAL, Profite REAL, discount REAL, tax REAL, payments TEXT, doc_created_date TEXT, doc_expire_date TEXT, doc_updated_date TEXT);
                CREATE TABLE IF NOT EXISTS user_subscriptions (user_id TEXT PRIMARY KEY, plan_id TEXT NOT NULL DEFAULT "free", status TEXT NOT NULL DEFAULT "free", payment_method TEXT NOT NULL DEFAULT "", billing_email TEXT NOT NULL DEFAULT "", paid_at TEXT NOT NULL DEFAULT "", updated_at TEXT NOT NULL);
            ');
            return $connection;
        }
    }
}

function app_json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
