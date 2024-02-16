module.exports = {
    "env": {
        "builtin": true,
        "es6": true
    },
    "plugins": [],
    "rules": {
        "arrow-parens": [2, "as-needed", { "requireForBlockBody": true }],
        "brace-style": [2, "1tbs", { "allowSingleLine": true }],
        "block-scoped-var": 2,
        "camelcase": 2,
        "comma-dangle": ["error", "always-multiline"],
        "comma-style": [2, "last"],
        "comma-spacing": 2,
        "consistent-return": 0,
        "curly": [
            2,
            "all"
        ],
        "dot-notation": [
            0,
            {
                "allowKeywords": true
            }
        ],
        "eol-last": 2,
        "eqeqeq": [
            2
        ],
        "guard-for-in": 2,
        "handle-callback-err": 2,
        "indent": [2, 4, {"SwitchCase": 1}],
        "key-spacing": 2,
        "new-cap": 2,
        "no-new-func": 2,
        "array-callback-return": 2,
        "no-array-constructor": 2,
        "no-bitwise": 2,
        "no-caller": 2,
        "no-cond-assign": [
            2,
            "always"
        ],
        "no-confusing-arrow": 2,
        "no-console": 2,
        "no-const-assign": 2,
        "no-debugger": 2,
        "no-dupe-class-members": 2,
        "no-duplicate-imports": 2,
        "no-empty": 0,
        "no-extra-boolean-cast": 0,
        "no-eval": 2,
        "no-extend-native": 2,
        "no-extra-bind": 2,
        "no-extra-parens": 0,
        "no-irregular-whitespace": 2,
        "no-iterator": 2,
        "no-loop-func": 2,
        "no-multiple-empty-lines": [
            2,
            {
                "max": 1
            }
        ],
        "no-multi-spaces": 2,
        "no-multi-str": 2,
        "no-native-reassign": 2,
        "no-new": 2,
        "no-new-object": 2,
        "no-path-concat": 0,
        "no-plusplus": 0,
        "no-process-exit": 0,
        "no-proto": 2,
        "no-redeclare": 2,
        "no-return-assign": 2,
        "no-script-url": 2,
        "no-sequences": 2,
        "no-shadow": 0,
        "no-spaced-func": 2,
        "no-trailing-spaces": 2,
        "no-underscore-dangle": 0,
        "no-undef": 2,
        "no-unused-vars": 2,
        "no-use-before-define": 2,
        "no-useless-constructor": 2,
        "no-var": 2,
        "no-with": 2,
        "object-shorthand": 2,
        "one-var": [2, "never"],
        "prefer-arrow-callback": 2,
        "prefer-const": 2,
        "quotes": [2, "double", {
            "avoidEscape": true,
            "allowTemplateLiterals": true
        }],
        "no-unreachable": 2,

        "semi": [
            2,
            "always"
        ],
        "semi-spacing": 2,
        "space-infix-ops": 2,
        "space-unary-ops": 0,
        "strict": [2, "global"],
        "valid-typeof": 2,
        "wrap-iife": [
            2,"any"
        ]
    }
};
