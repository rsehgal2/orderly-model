function timestamp() {
  return new Date().toISOString();
}

function format(level, callId, message, meta) {
  const prefix = `[${timestamp()}] [${level}]${callId ? ` [call:${callId}]` : ""}`;
  return meta ? `${prefix} ${message} ${JSON.stringify(meta)}` : `${prefix} ${message}`;
}

const logger = {
  info: (message, meta, callId) => console.log(format("INFO", callId, message, meta)),
  warn: (message, meta, callId) => console.warn(format("WARN", callId, message, meta)),
  error: (message, meta, callId) => console.error(format("ERROR", callId, message, meta)),
  debug: (message, meta, callId) => {
    if (process.env.DEBUG) console.log(format("DEBUG", callId, message, meta));
  },
};

module.exports = logger;
