// must be run with pm2
// npm install -g pm2
// pm2 start ecosystem.config.js
// pm2 monit
const os = require("os");
console.log("User info:", userInfo);

module.exports = {
  apps: [
    {
      name: "worker",
      cwd: "./backend",
      script: "/usr/local/bin/python3",
      args: `-m celery -A dispatch worker --loglevel=INFO -n worker.paul${userInfo.uid}@%h`,
      watch: false,
      interpreter: "",
      max_memory_restart: "1G"
    },
    {
      name: "frontend",
      cwd: "./frontend",
      script: "npm",
      args:"start",
    }
  ]
};