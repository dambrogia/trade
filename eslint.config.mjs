// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "comma-dangle": ["error", "always-multiline"],
            "semi": ["error", "always"],
            "object-curly-spacing": ["error", "never"],
            "array-bracket-spacing": ["error", "never"],
            "quotes": ["error", "single"],
            "@typescript-eslint/no-explicit-any": ["off", { "ignoreRestArgs": true }]
        }
    }
);
