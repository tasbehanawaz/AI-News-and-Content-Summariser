module.exports = {
  apps: [
    {
      name: 'web-app',
      script: 'npm',
      args: 'run dev',
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'newsletter-service',
      script: 'npm',
      args: 'run newsletter',
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
}; 