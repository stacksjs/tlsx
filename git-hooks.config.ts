export default {
  'pre-commit': {
    'staged-lint': {
      '**/*.{js,ts,json,yaml,yml,md}': 'bunx --bun pickier . --fix',
    },
  },
  'commit-msg': 'bunx gitlint --edit .git/COMMIT_EDITMSG',
}
