module.exports = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(png|jpg|jpeg|gif|svg)$/i,
      type: "asset/inline",
    });

    // We need to push our configuration in front of
    // the standard one, otherwise the worker code doesn't get handled correctly.
    config.module.rules = [
      {
        test: /\.worker\.ts$/,
        use: [
          {
            loader: "worker-loader",
            options: { inline: "no-fallback" }, // Force to inline the worker as a blob.
          },
          {
            loader: "ts-loader", // use ts-loader to transpile ts > js
          },
        ],
      },
      ...config.module.rules,
    ];

    config.resolve.fallback = { stream: false };

    return config;
  },
};
