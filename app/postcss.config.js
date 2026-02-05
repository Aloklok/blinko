export default {
    plugins: {
        'postcss-preset-env': {
            stage: 3,
            features: {
                'color-mix': true,
                'nesting-rules': true,
            },
            browsers: 'safari 15',
            autoprefixer: { grid: true }
        }
    }
}
