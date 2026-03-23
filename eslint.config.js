import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import typescript from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
    js.configs.recommended,
    ...typescript.configs.recommended,
    {
        ...react.configs.flat.recommended,
        ...react.configs.flat['jsx-runtime'], // Required for React 17+
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react/no-unescaped-entities': 'off',
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/App.tsx'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['backend', 'backend/*', '../backend', '../../backend', '../../../backend', '../../../../backend', '../../../../../backend'],
                            message: 'Use useWorkspace/Workspace APIs; do not import backend modules directly in UI code.',
                        },
                    ],
                },
            ],
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "CallExpression[callee.object.object.name='ws'][callee.object.property.name='refresh'][callee.property.name='branchContext'][arguments.length>0]",
                    message: 'ws.refresh.branchContext() must be called with no arguments.',
                },
            ],
        },
    },
    {
        ignores: ['vendor', 'node_modules', 'public', 'dist', 'bootstrap/ssr', 'tailwind.config.js', 'scripts', 'src'],
    },
    prettier, // Turn off all rules that might conflict with Prettier
];
