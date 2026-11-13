-- 003: fix stale-snapshot reads in transfer_funds.
-- Under REPEATABLE READ a plain SELECT after waiting for a row lock still reads the transaction's
-- old snapshot, so a second concurrent transfer could see the pre-commit balance, pass the funds
-- check and only be stopped by CHECK ck_balance (surfacing as HTTP 500). Re-reading the rows with
-- FOR UPDATE (a "current read") always returns the latest committed values.
DELIMITER $$
DROP PROCEDURE IF EXISTS transfer_funds$$
CREATE PROCEDURE transfer_funds(IN p_actor CHAR(36),IN p_sender CHAR(36),IN p_receiver CHAR(36),IN p_amount BIGINT,IN p_key VARCHAR(100),IN p_hash CHAR(64),IN p_description VARCHAR(255),IN p_kind VARCHAR(20))
SQL SECURITY DEFINER
proc: BEGIN
 DECLARE v_sender_user CHAR(36); DECLARE v_receiver_user CHAR(36); DECLARE v_dummy CHAR(36);
 DECLARE v_sender_status VARCHAR(20); DECLARE v_receiver_status VARCHAR(20); DECLARE v_sender_type VARCHAR(20); DECLARE v_receiver_type VARCHAR(20);
 DECLARE v_actor_role VARCHAR(20); DECLARE v_actor_status VARCHAR(20); DECLARE v_suser_status VARCHAR(20); DECLARE v_ruser_status VARCHAR(20);
 DECLARE v_balance BIGINT; DECLARE v_hash CHAR(64); DECLARE v_response JSON; DECLARE v_tx CHAR(36); DECLARE v_ref VARCHAR(40);
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET @actor_id=NULL; RESIGNAL; END;
 START TRANSACTION;
 SET @actor_id=p_actor;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>1000000000000 OR p_sender=p_receiver OR p_kind NOT IN ('TRANSFER','ADJUSTMENT') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INVALID_TRANSFER'; END IF;
 SELECT user_id INTO v_sender_user FROM accounts WHERE id=p_sender;
 SELECT user_id INTO v_receiver_user FROM accounts WHERE id=p_receiver;
 IF v_sender_user IS NULL OR v_receiver_user IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ACCOUNT_NOT_FOUND'; END IF;
 -- Lock owners and actor in deterministic order before accounts.
 BEGIN
 DECLARE done INT DEFAULT 0;
 DECLARE users_cursor CURSOR FOR SELECT id FROM users WHERE id IN (v_sender_user,v_receiver_user,p_actor) ORDER BY id FOR UPDATE;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET done=1;
 OPEN users_cursor;
 user_loop: LOOP FETCH users_cursor INTO v_dummy; IF done=1 THEN LEAVE user_loop; END IF; END LOOP;
 CLOSE users_cursor;
 END;
 SELECT role,status INTO v_actor_role,v_actor_status FROM users WHERE id=p_actor FOR UPDATE;
 SELECT status INTO v_suser_status FROM users WHERE id=v_sender_user FOR UPDATE;
 SELECT status INTO v_ruser_status FROM users WHERE id=v_receiver_user FOR UPDATE;
 IF v_actor_role IS NULL OR v_actor_status<>'ACTIVE' OR v_suser_status<>'ACTIVE' OR v_ruser_status<>'ACTIVE' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='USER_INACTIVE'; END IF;
 INSERT INTO idempotency_records(user_id,idempotency_key,request_hash,status) VALUES(p_actor,p_key,p_hash,'PENDING') ON DUPLICATE KEY UPDATE id=id;
 SELECT request_hash,response_data INTO v_hash,v_response FROM idempotency_records WHERE user_id=p_actor AND idempotency_key=p_key FOR UPDATE;
 IF v_hash<>p_hash THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IDEMPOTENCY_CONFLICT'; END IF;
 IF v_response IS NOT NULL THEN COMMIT; SET @actor_id=NULL; SELECT v_response AS result; LEAVE proc; END IF;
 SELECT id INTO v_dummy FROM accounts WHERE id=LEAST(p_sender,p_receiver) FOR UPDATE;
 SELECT id INTO v_dummy FROM accounts WHERE id=GREATEST(p_sender,p_receiver) FOR UPDATE;
 SELECT balance,status,account_type INTO v_balance,v_sender_status,v_sender_type FROM accounts WHERE id=p_sender FOR UPDATE;
 SELECT status,account_type INTO v_receiver_status,v_receiver_type FROM accounts WHERE id=p_receiver FOR UPDATE;
 IF v_sender_status<>'ACTIVE' OR v_receiver_status<>'ACTIVE' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ACCOUNT_INACTIVE'; END IF;
 IF p_kind='TRANSFER' AND (v_sender_user<>p_actor OR v_sender_type='EQUITY' OR v_receiver_type='EQUITY') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FORBIDDEN'; END IF;
 IF p_kind='ADJUSTMENT' AND (v_actor_role<>'ADMIN' OR v_sender_type<>'EQUITY' OR v_receiver_type='EQUITY') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FORBIDDEN'; END IF;
 IF v_sender_type<>'EQUITY' AND v_balance<p_amount THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='INSUFFICIENT_FUNDS'; END IF;
 SET v_tx=UUID(); SET v_ref=CONCAT('NX-',REPLACE(v_tx,'-',''));
 UPDATE accounts SET balance=balance-p_amount WHERE id=p_sender;
 UPDATE accounts SET balance=balance+p_amount WHERE id=p_receiver;
 INSERT INTO transactions(id,reference_number,actor_user_id,sender_account_id,receiver_account_id,amount,transaction_type,description) VALUES(v_tx,v_ref,p_actor,p_sender,p_receiver,p_amount,p_kind,p_description);
 INSERT INTO ledger_entries(transaction_id,account_id,amount) VALUES(v_tx,p_sender,-p_amount),(v_tx,p_receiver,p_amount);
 SET v_response=JSON_OBJECT('id',v_tx,'reference',v_ref,'amount',CAST(p_amount AS CHAR),'status','COMPLETED');
 UPDATE idempotency_records SET status='COMPLETED',response_data=v_response WHERE user_id=p_actor AND idempotency_key=p_key;
 COMMIT;
 SET @actor_id=NULL;
 SELECT v_response AS result;
END$$
DELIMITER ;
