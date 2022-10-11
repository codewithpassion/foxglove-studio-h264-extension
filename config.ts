module.exports = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(png|jpg|jpeg|gif|svg)$/i,
      type: "asset/inline",
    });
    config.resolve.fallback = { stream: false };
    return config;
  },
};
