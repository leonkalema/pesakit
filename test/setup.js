// Keep nock in charge: strip any proxy settings from the environment.
for (const name of Object.keys(process.env)) {
  if (/proxy/i.test(name)) delete process.env[name];
}
process.env.NODE_ENV = 'test';
