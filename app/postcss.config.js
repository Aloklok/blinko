export default {
    plugins: {
        'postcss-preset-env': {
            stage: 2,
            features: {
                // 'color-mix': { preserve: false }, // [Disabled for Safari 17.6]
                'nesting-rules': true,
            },
            // browsers: ['safari >= 15'], // [Disabled for Safari 17.6]
            autoprefixer: {
                grid: true,
                flexbox: true
            }
        }
    }
}

