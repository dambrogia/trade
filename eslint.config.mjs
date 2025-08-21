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
            "max-len": ["error", { "code": 120, "ignoreStrings": true, "ignoreUrls": true }],
            "object-curly-spacing": ["error", "never"],
            "array-bracket-spacing": ["error", "never"],
            "quotes": ["error", "single"],
            "@typescript-eslint/no-explicit-any": ["off", { "ignoreRestArgs": true }],
            "@typescript-eslint/no-unused-expressions": ["error", {
                "allowShortCircuit": true,
                "allowTernary": true
            }]
        }
    }
);
