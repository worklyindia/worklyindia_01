SELECT cron.alter_job(18, schedule => '*/15 * * * *');
SELECT cron.alter_job(19, schedule => '5,20,35,50 * * * *');
SELECT cron.alter_job(16, schedule => '10,25,40,55 * * * *');