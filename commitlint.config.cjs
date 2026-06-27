/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复
        'docs', // 文档
        'style', // 格式（不影响代码）
        'refactor', // 重构
        'perf', // 性能
        'test', // 测试
        'build', // 构建
        'ci', // CI
        'chore', // 杂项
        'revert', // 回滚
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
  },
}
