# Running NEXBANK on MySQL in AWS RDS

NEXBANK needs MySQL 8.x with InnoDB. Amazon RDS for MySQL 8.0 or 8.4 works unchanged; the code only needs a connection URL.

## 1. Create the instance (AWS Console)
1. RDS -> Create database -> Standard create -> **MySQL**, engine 8.4 (or 8.0), template **Free tier** / Dev-Test.
2. DB instance identifier `nexbank-db`; master username `admin`; set a strong master password.
3. Instance class `db.t4g.micro` or `db.t3.micro`, storage 20 GB gp3, no autoscaling needed.
4. Connectivity: **Public access = Yes** (for a college demo), choose/create a VPC security group.
5. Initial database name: `nexbank`.
6. Create database and wait until status is **Available**; copy the **Endpoint** (e.g. `nexbank-db.abc123.ap-south-1.rds.amazonaws.com`).

## 2. Security group
Edit the instance's security group -> Inbound rule: type MYSQL/Aurora, port 3306, source **My IP**. Never use 0.0.0.0/0.

## 3. Parameter group (important for triggers and procedures)
Automated backups turn on binary logging, and then MySQL refuses to create triggers/procedures unless the parameter below is set (error 1419 "You do not have the SUPER privilege and binary logging is enabled").
1. RDS -> Parameter groups -> Create (family mysql8.x) -> edit `log_bin_trust_function_creators` = **1**.
2. Modify the instance -> DB parameter group = the new group -> apply immediately, then **reboot** the instance.
Optional for the viva: set `transaction_isolation` to REPEATABLE-READ (default) and keep `innodb_deadlock_detect` = 1 (default) so deadlocks are detected and one victim gets error 1213, which `retryDeadlock` retries.

## 4. TLS certificate
Download https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem into the project root.

## 5. Create the two extra schemas
```bash
mysql -h <endpoint> -u admin -p --ssl-ca=global-bundle.pem < database/init-databases.sql
```
(creates `nexbank_test` and `nexbank_lab`; `nexbank` already exists.)

## 6. Configure NEXBANK
Edit `backend/.env` (URL-encode special characters in the password, e.g. `@` -> `%40`):
```
DATABASE_URL=mysql://admin:PASSWORD@<endpoint>:3306/nexbank
MIGRATION_DATABASE_URL=mysql://admin:PASSWORD@<endpoint>:3306/nexbank
LAB_DATABASE_URL=mysql://admin:PASSWORD@<endpoint>:3306/nexbank_lab
DB_SSL_CA_FILE=../global-bundle.pem
```
`DB_SSL_CA_FILE` is resolved from the folder you start the backend in (`backend/`). Certificate verification stays ON.

## 7. Run
```bash
npm run db:migrate
npm run db:seed
npm run dev:backend      # terminal 1
npm run dev:frontend     # terminal 2  -> http://localhost:5173
```
Check `http://localhost:4000/health/ready` returns `{"status":"ready"}`.

## 8. Troubleshooting
| Symptom | Cause / fix |
|---|---|
| `ETIMEDOUT` | Security group does not allow your current IP, or Public access = No |
| Error 1419 during migrate | Parameter group step 3 not applied / instance not rebooted |
| `self-signed certificate in certificate chain` | Wrong/missing `DB_SSL_CA_FILE`; use the RDS global bundle |
| `Access denied` | Password contains special characters that are not URL-encoded |

## 9. Cost
Stop or delete the instance after the demo (RDS -> Actions -> Stop temporarily, or Delete with a final snapshot off). A stopped instance restarts automatically after 7 days.
