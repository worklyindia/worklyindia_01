// PM2 config for the Node helper server (server.js)
module.exports = {
  apps: [
    {
      name: "workly-api",
      script: "server.js",
      cwd: "/var/www/workly",
      instances: 1,
      autorestart: true,
      max_memory_restart: "300M",
      env: { NODE_ENV: "production" },
    },
  ],
};
