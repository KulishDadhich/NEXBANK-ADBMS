CREATE TABLE users (
 id CHAR(36) PRIMARY KEY, full_name VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, phone VARCHAR(30), role ENUM('USER','ADMIN','SYSTEM') NOT NULL DEFAULT 'USER',
 status ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
CREATE TABLE accounts (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, account_number VARCHAR(24) NOT NULL UNIQUE,
 account_type ENUM('SAVINGS','CURRENT','EQUITY') NOT NULL DEFAULT 'SAVINGS', balance BIGINT NOT NULL DEFAULT 0,
 currency CHAR(3) NOT NULL DEFAULT 'INR', status ENUM('ACTIVE','FROZEN','CLOSED') NOT NULL DEFAULT 'ACTIVE',
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 CONSTRAINT fk_account_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT ck_balance CHECK(account_type='EQUITY' OR balance>=0), CONSTRAINT ck_currency CHECK(currency='INR'), INDEX ix_account_user(user_id)
) ENGINE=InnoDB;
CREATE TABLE transactions (
 id CHAR(36) PRIMARY KEY, reference_number VARCHAR(40) NOT NULL UNIQUE, actor_user_id CHAR(36) NOT NULL,
 sender_account_id CHAR(36) NOT NULL, receiver_account_id CHAR(36) NOT NULL, amount BIGINT NOT NULL,
 transaction_type ENUM('TRANSFER','ADJUSTMENT') NOT NULL, status ENUM('COMPLETED') NOT NULL DEFAULT 'COMPLETED', description VARCHAR(255) NOT NULL DEFAULT '', created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(actor_user_id) REFERENCES users(id), FOREIGN KEY(sender_account_id) REFERENCES accounts(id), FOREIGN KEY(receiver_account_id) REFERENCES accounts(id),
 CHECK(amount>0), CHECK(sender_account_id<>receiver_account_id), INDEX ix_sender_time(sender_account_id,created_at), INDEX ix_receiver_time(receiver_account_id,created_at), INDEX ix_transaction_time(created_at)
) ENGINE=InnoDB;
CREATE TABLE ledger_entries (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, transaction_id CHAR(36) NOT NULL, account_id CHAR(36) NOT NULL, amount BIGINT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT,
 FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT, UNIQUE(transaction_id,account_id), CHECK(amount<>0), INDEX ix_ledger_account(account_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE beneficiaries (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, beneficiary_account_id CHAR(36) NOT NULL, nickname VARCHAR(80) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(beneficiary_account_id) REFERENCES accounts(id), UNIQUE(user_id,beneficiary_account_id)
) ENGINE=InnoDB;
CREATE TABLE audit_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, actor_user_id CHAR(36), action VARCHAR(50) NOT NULL, table_name VARCHAR(64) NOT NULL, record_id CHAR(36) NOT NULL,
 old_values JSON, new_values JSON, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX ix_audit_time(created_at)
) ENGINE=InnoDB;
CREATE TABLE login_sessions (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME(3) NOT NULL, revoked_at DATETIME(3),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(user_id) REFERENCES users(id), INDEX ix_session_user(user_id)
) ENGINE=InnoDB;
CREATE TABLE idempotency_records (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id CHAR(36) NOT NULL, idempotency_key VARCHAR(100) NOT NULL, request_hash CHAR(64) NOT NULL,
 response_data JSON, status ENUM('PENDING','COMPLETED') NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id), UNIQUE(user_id,idempotency_key)
) ENGINE=InnoDB;
CREATE TABLE failed_attempts (
 id CHAR(36) PRIMARY KEY, actor_user_id CHAR(36) NOT NULL, reason VARCHAR(100) NOT NULL, request_data JSON NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(actor_user_id) REFERENCES users(id), INDEX ix_failed_time(created_at)
) ENGINE=InnoDB;
DELIMITER $$
CREATE TRIGGER account_audit AFTER UPDATE ON accounts FOR EACH ROW
BEGIN
 INSERT INTO audit_logs(actor_user_id,action,table_name,record_id,old_values,new_values)
 VALUES(@actor_id,'ACCOUNT_UPDATE','accounts',NEW.id,JSON_OBJECT('balance',CAST(OLD.balance AS CHAR),'status',OLD.status),JSON_OBJECT('balance',CAST(NEW.balance AS CHAR),'status',NEW.status));
END$$
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger_entries FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ledger entries are immutable'$$
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger_entries FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ledger entries are immutable'$$
CREATE TRIGGER transaction_no_update BEFORE UPDATE ON transactions FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Posted transactions are immutable'$$
CREATE TRIGGER transaction_no_delete BEFORE DELETE ON transactions FOR EACH ROW
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Posted transactions are immutable'$$
DELIMITER ;
CREATE VIEW account_transaction_summary AS SELECT a.id,a.account_number,a.balance,COUNT(l.id) AS entries,COALESCE(SUM(l.amount),0) AS ledger_balance FROM accounts a LEFT JOIN ledger_entries l ON a.id=l.account_id GROUP BY a.id;
CREATE VIEW user_account_overview AS SELECT u.id AS user_id,u.full_name,a.id AS account_id,a.account_number,a.balance,a.status FROM users u JOIN accounts a ON a.user_id=u.id WHERE u.role<>'SYSTEM';
CREATE VIEW admin_transaction_statistics AS SELECT COUNT(*) AS completed,COALESCE(SUM(amount),0) AS volume FROM transactions;
CREATE VIEW monthly_transaction_totals AS SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,transaction_type,COUNT(*) AS count,SUM(amount) AS total FROM transactions GROUP BY month,transaction_type;
