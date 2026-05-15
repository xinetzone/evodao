## 信息脱敏规则

### 2.1 敏感信息分类与识别标准

定义以下6大类敏感信息：

| 类别 | 包含内容 | 风险等级 | 识别特征 |
| ---- | -------- | -------- | -------- |
| **个人身份信息（PII）** | 姓名、身份证号、手机号、邮箱地址等 | 高 | 符合中国身份证格式（18位）、手机号（11位以1开头）、邮箱格式 |
| **认证凭据** | 密码、用户名、证书私钥等 | 高 | 明文密码字段、私钥文件（BEGIN PRIVATE KEY）、用户名密码对 |
| **API 密钥与 Token** | Jira API Token、钉钉 Webhook Token、AWS Access Key 等 | 高 | 含有 token、key、secret、credential 等关键字的长字符串 |
| **内部系统地址** | 内网 URL、数据库连接串、内部服务地址等 | 中 | 内网 IP（10.x.x.x、192.168.x.x）、数据库连接字符串 |
| **业务数据** | 财务数据、客户信息、性能指标等 | 中/低 | 财务金额、客户名单、内部统计数据 |
| **其他敏感信息** | Git 历史中的凭证、CI/CD 配置中的敏感信息等 | 变 | 历史提交中的密码、CI 配置中的环境变量 |

**识别示例（均为虚构示例数据）：**

```
# 个人身份信息 — 符合格式特征的个人标识数据 → 高
# 认证凭据 — 含有密码、密钥关键字的长字符串 → 高
# API 密钥 — 含有 token/key/secret 关键字的字符串 → 高
# 内部系统地址 — 内网 IP 段或数据库连接字符串 → 中
```

### 2.2 脱敏处理方式详解

定义4种标准脱敏方式：

#### a) 部分隐藏（Partial Masking）

**适用场景：** 手机号、邮箱、身份证号等格式化数据

**格式示例：**

| 数据类型 | 原始值 | 脱敏后 | 规则说明 |
| -------- | ------ | ------ | -------- |
| 手机号 | 13812345678 | `138****5678` | 保留前3后4位 |
| 邮箱 | zhangsan@example.com | `z***@example.com` | 隐藏用户名中间字符 |
| 身份证号 | 110101199001011234 | `110***********1234` | 保留前3后4位 |
| 姓名 | 张三 | `张*` 或 `张**` | 保留姓氏 |

#### b) 占位符替换（Placeholder Replacement）

**适用场景：** 密码、Token、密钥、API Key 等非结构化凭证

**标准化占位符列表：**

| 占位符 | 用途 | 示例场景 |
| ------ | ---- | -------- |
| `<PASSWORD>` | 密码 | 数据库密码、系统登录密码 |
| `<USERNAME>` | 用户名 | 服务账户名 |
| `<API_KEY>` / `<API_SECRET>` | API 密钥 | 第三方服务 API 密钥 |
| `<TOKEN>` / `<ACCESS_TOKEN>` | 令牌 | OAuth Token、Session Token |
| `<WEBHOOK_TOKEN>` | Webhook Token | 钉钉/企业微信 Webhook |
| `<PRIVATE_KEY>` | 私钥内容 | TLS 证书、SSH 密钥 |
| `<REDACTED>` | 通用脱敏标记 | 无法确定类型的敏感信息 |
| `<DATABASE_URL>` | 数据库连接串 | 完整的数据库连接字符串 |

#### c) 完全删除（Complete Removal）

**适用场景：** 私钥文件完整内容、数据库连接串中的明文密码、高敏感度的业务数据

**处理方式：** 完全移除该信息，仅保留字段名和注释说明

**示例：**

```python
# 脱敏前
db_config = {
    "host": "10.16.1.100",
    "port": 3306,
    "user": "admin",
    "password": "Hp#!8CocD_g"
}

# 脱敏后
db_config = {
    "host": "<DATABASE_HOST>",
    "port": 3306,
    "user": "<USERNAME>",
    "password": "<PASSWORD>"  # 请从配置文件加载
}
```

#### d) 加密处理（Encryption）（可选）

**适用场景：** 必须保留原始格式但需防止明文泄露的场景

**处理方式：**
- 使用不可逆哈希（如 SHA-256）
- 使用项目特定的加密方案
- 仅在必须验证原始值时使用可逆加密

```python
import hashlib

def encrypt_sensitive(value: str) -> str:
    """使用 SHA-256 对敏感信息进行不可逆哈希"""
    return hashlib.sha256(value.encode()).hexdigest()

# 示例
original_token = "abc123token456"
encrypted = encrypt_sensitive(original_token)
# 输出: "a1b2c3d4e5f6..." (64位十六进制字符串)
```

### 2.3 适用范围与例外情况

#### a) 适用范围

以下场景**必须执行脱敏**：

- ✅ 源代码文件（Python、Shell、Groovy 等）
- ✅ 日志输出（应用日志、访问日志、错误日志）
- ✅ 配置文件（TOML、JSON、YAML、INI 等）
- ✅ 项目文档（README、API 文档、技术方案）
- ✅ 错误消息和异常堆栈
- ✅ CI/CD 流水线日志和配置
- ✅ Git 提交记录和 Pull Request 描述
- ✅ 数据库备份和导出文件

#### b) 合法例外情况

以下情况**可豁免脱敏**，但需标注原因：

| 例外类型 | 说明 | 标注要求 |
| -------- | ---- | -------- |
| 内网 IP 地址 | 10.x.x.x、192.168.x.x、172.16-31.x.x | 仅在内网环境有效 |
| 测试环境占位符 | test@example.com、password123 | 明确为虚构测试数据 |
| 公开文档示例 | 明确标注为示例的数据 | 添加"示例数据"注释 |
| 加密哈希值 | SHA-256、MD5 等不可逆结果 | 已是不可逆形式 |
| 已实现的脱敏代码 | logger.py 中的正则脱敏逻辑 | 代码本身即合规实现 |
| 单元测试凭证 | test_*.py 中的虚假数据 | 文件名含 test_ 前缀 |
| 第三方依赖库 | 3rdparty/ 目录下的代码 | 不纳入项目管控 |

#### c) 例外情况审批流程

```
开发者发现应豁免的信息
    ↓
添加标注: # DESENSITIZATION_EXEMPTION: <原因>
    ↓
提交 Pull Request
    ↓
代码审查人确认豁免合理性
    ↓
记录至例外清单 (.desensitization-exemptions.md)
```

### 2.4 实施步骤与验证流程

#### a) 阶段一：实施前准备

**步骤 1：敏感信息资产盘点**

```bash
# 运行全量扫描
python scripts/scan_sensitive.py

# 输出示例：
# [HIGH] file.py:42 - 检测到疑似手机号: 138****5678
# [HIGH] config.toml:15 - 检测到疑似密码字段
# [MEDIUM] db_connection.py:8 - 检测到内网 IP 地址
```

**输出物：** 敏感信息资产清单（文件路径、行号、信息类型、风险等级）

**步骤 2：制定脱敏计划**
- 根据风险等级排序（高 → 中 → 低）
- 为每个敏感信息项指定脱敏方式和责任人
- 设定完成时间节点

**步骤 3：责任分配与培训**
- 明确各模块的脱敏责任人
- 组织团队学习本规范文档
- 准备配置文件模板（~/.env.jira.example、~/.env.xmnn.example 等）

**阶段一输出物：**
- ✅ 敏感信息资产清单
- ✅ 脱敏计划文档
- ✅ 责任分配表

#### b) 阶段二：实施执行

**步骤 1：按计划逐项执行脱敏**

每个敏感信息的处理流程：

```
识别 → 选择方式 → 应用处理 → 记录日志
```

**记录日志格式：**

```json
{
  "timestamp": "2026-05-13T10:30:00",
  "file": "config/database.py",
  "line": 15,
  "info_type": "password",
  "risk_level": "high",
  "method": "placeholder_replacement",
  "operator": "developer_name",
  "original_hash": "a1b2c3d4..."
}
```

**步骤 2：同步更新相关配置**
- 将敏感信息迁移至外部配置文件
- 更新配置文件的 .example 模板
- 确保配置加载逻辑正确

**阶段二输出物：**
- ✅ 脱敏操作日志
- ✅ 更新的配置文件及模板

#### c) 阶段三：验证确认

**步骤 1：自动化扫描验证**

```bash
# 扫描改造后的代码
python scripts/scan_sensitive.py
# 确认无 high 级别的新增匹配
# 生成扫描报告
```

**步骤 2：人工审核高风险项**
- 安全负责人审核 medium 和 low 级别项
- 确认是否需要进一步处理

**步骤 3：全量回归测试**

```bash
# 运行单元测试确保功能未受影响
uv run pytest

# 运行 lint 确保代码质量
uv run ruff check python/ plugins/tasks/

# 验证配置加载逻辑正确性
python scripts/check_config_consistency.py
```

**步骤 4：记录与归档**
- 更新验证记录（通过/不通过、遗留问题、下一步计划）
- 将脱敏操作日志和验证报告归档

**阶段三输出物：**
- ✅ 扫描验证报告
- ✅ 人工审核记录
- ✅ 测试通过证明

### 2.5 全生命周期执行机制

#### a) 开发阶段控制措施

| 控制措施 | 实施方式 | 工具/方法 |
| -------- | -------- | --------- |
| 实时检测 | pre-commit 钩子 | `python scripts/scan_sensitive.py` |
| IDE 支持 | 安装检测插件 | git-secrets、detect-secrets |
| 代码审查 | PR 审查清单 | 必须包含"脱敏合规性检查"项 |
| 本地验证 | 提交前自检 | `python scripts/scan_sensitive.py` |

**Pre-commit 钩子配置示例（.pre-commit-config.yaml）：**

```yaml
repos:
  - repo: local
    hooks:
      - id: scan-sensitive
        name: Scan Sensitive Info
        entry: python scripts/scan_sensitive.py
        language: system
        pass_filenames: false
        always_run: true
```

#### b) 测试阶段控制措施

- ✅ 测试数据使用虚构占位符（如 `test_user`、`test_password`）
- ✅ 测试环境配置从专用测试配置文件加载
- ✅ 测试日志自动脱敏或限制访问权限
- ✅ 测试数据库使用假名化或合成数据

#### c) CI/CD 阶段控制措施

| 控制措施 | 说明 | 配置位置 |
| -------- | ---- | -------- |
| 自动化扫描 | 集成扫描脚本 | `.github/workflows/*.yml` |
| 阻断机制 | high 级别匹配时流水线失败 | CI 配置 |
| 通知机制 | 失败时通知提交者和安全负责人 | GitHub Actions |
| 定期扫描 | 每日定时扫描 main 分支 | Cron Job |

**相关工具：**
- 扫描脚本：`scripts/scan_sensitive.py`
- 规则配置：`.sensitive-patterns.toml`
- 排除列表：`.scanignore`

**CI 集成示例：**

```yaml
- name: Scan Sensitive Information
  run: |
    python scripts/scan_sensitive.py --json > scan_report.json
    if grep -q '"level":"high"' scan_report.json; then
      echo "ERROR: Found high-risk sensitive information"
      exit 1
    fi
```

#### d) 部署阶段控制措施

- ✅ 生产配置单独管理，不纳入版本库
- ✅ 使用密钥管理系统（KMS）或环境变量注入敏感配置
- ✅ 部署脚本中的临时凭证在使用后立即清除
- ✅ 容器镜像不包含任何敏感信息

#### e) 运维阶段控制措施

| 控制措施 | 实施方式 | 频率 |
| -------- | -------- | ---- |
| 日志自动脱敏 | logger.py 正则逻辑 | 实时 |
| 导出前检查 | 运行扫描工具二次检查 | 每次导出 |
| 定期审计 | 审查生产配置和日志样本 | 每月 |
| 访问控制 | 限制敏感日志访问权限 | 持续 |
| 监控告警 | 异常访问模式告警 | 实时 |

### 2.6 规则更新与维护流程

#### a) 定期评审机制

**评审周期：** 每季度一次（建议为每个季度的第一周）

**触发条件：**
- ⏰ 到达预定的评审周期
- 🚨 发生重大安全事件或数据泄露事故后
- 📋 监管要求或行业标准变更时
- 🔧 项目引入新的数据类型或技术栈时

**评审内容：**
1. 评估现有规则的有效性和覆盖率
2. 审查过去一季度发现的例外情况和豁免记录
3. 收集团队成员反馈和改进建议
4. 识别新增的敏感信息类型
5. 评估自动化扫描工具的检测效果

**评审输出：**
- ✅ 更新后的规则文档
- ✅ 更新的扫描规则文件
- ✅ 更新的培训材料

**责任人：** 安全负责人组织，全体开发者参与

#### b) 应急更新流程

**触发条件：**
- 🆕 发现新的敏感信息泄露风险（如新型攻击手法）
- 🔍 安全扫描发现现有规则未能覆盖的情况
- 📢 监管机构发布新的合规要求
- 📝 第三方安全审计提出整改意见

**响应流程：**

```
发现人报告安全负责人
    ↓ (立即)
安全负责人评估风险等级 (24小时内)
    ↓
┌─ 高风险 → 紧急评审 (48小时内) → 规则补丁 → 全员通知
│
├─ 中风险 → 常规评审 (1周内) → 规则更新 → 团队通知
│
└─ 低风险 → 纳入定期评审队列
```

**响应时间目标：**

| 风险等级 | 响应时间 | 处理方式 |
| -------- | -------- | -------- |
| 高风险 | 24-48 小时 | 紧急评审 + 快速发布补丁 |
| 中风险 | 1 周 | 常规评审 + 规则更新 |
| 低风险 | 下次定期评审 | 纳入评审议程 |

#### c) 版本管理与追溯

**变更记录要求：**

每次规则变更必须在 AGENTS.md 章节末尾维护变更日志表格：

| 变更日期 | 变更内容 | 变更原因 | 影响范围 | 责任人 | 审批人 |
| -------- | -------- | -------- | -------- | ------ | ------ |
| 2026-05-13 | 新增信息脱敏规则章节 | 初始建立规范 | 全项目 | - | - |

**版本保留：**
- 通过 Git 历史保留所有版本的规则文档
- 重大变更需打标签便于回溯（如 `desensitization-rule-v2.0`）

**审计支持：**
- 保留最近 2 年的所有变更记录
- 支持内外部安全审计的查阅需求

#### d) 培训与宣贯

| 培训类型 | 触发时机 | 内容 | 参与人员 |
| -------- | -------- | ---- | -------- |
| 入职培训 | 新成员入职时 | 完整规范解读 + 工具使用 | 新入职开发者 |
| 规则更新培训 | 重大变更后 | 变更内容 + 影响分析 | 全体开发团队 |
| 季度复习 | 每季度评审后 | 复盘常见问题 + 最佳实践 | 全体开发团队 |
| 专项培训 | 安全事件后 | 事件分析 + 预防措施 | 相关人员 |

**考核机制：**
- 将脱敏合规性纳入代码质量考核指标
- 统计每季度的脱敏违规次数并公示
- 对重复违规者进行专项辅导

### 2.7 相关工具与资源链接

#### 自动化扫描工具

**扫描脚本：** `scripts/scan_sensitive.py`
- **用途：** 递归扫描项目文件，检测疑似敏感信息
- **使用方法：**
  ```bash
  # 扫描当前目录
  python scripts/scan_sensitive.py

  # 扫描指定目录
  python scripts/scan_sensitive.py plugins/npu_tvm/

  # 输出 JSON 格式（用于 CI 集成）
  python scripts/scan_sensitive.py --json
  ```

**规则配置：** `.sensitive-patterns.toml`
- **用途：** 定义敏感信息匹配模式（正则表达式）
- **可扩展：** 新增检测模式只需在此文件添加条目

**排除列表：** `.scanignore`
- **用途：** 指定不需要扫描的目录和文件
- **格式示例：**
  ```
  # 第三方依赖
  3rdparty/

  # 测试文件
  tests/test_*.py

  # 生成的文件
  *.generated.py
  ```

#### 配置文件管理

**Jira 凭证配置：**
- `~/.env.jira`（key=value 格式）
- `~/.jira/profiles.json`（JSON 格式，推荐）
- 设置工具：`.agents/skills/jira-skill/skills/jira-communication/scripts/core/jira-setup.py`

**设备配置：**
- `~/.env.xmnn`（Telnet 设备密码等）

**配置模板示例：**

```bash
# ~/.env.jira.example（提交至版本库的模板）
JIRA_URL=https://jira.example.com
JIRA_USERNAME=your_username
JIRA_API_TOKEN=your_api_token_here
```

#### 参考资源

| 资源名称 | 链接 | 用途 |
| -------- | ---- | ---- |
| OWASP 敏感数据保护指南 | https://owasp.org/www-project-sensitive-data-protection/ | 行业标准参考 |
| Git-secrets 工具 | https://github.com/awslabs/git-secrets | Git 历史扫描 |
| Detect-secrets 工具 | https://github.com/Yelp/detect-secrets | 高级秘密检测 |
| truffleHog | https://github.com/trufflesecurity/trufflehog | Git 历史深度扫描 |

---
