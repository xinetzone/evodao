import { OutputMode } from "@/hooks/useEvodaoAgent";

export interface PromptItem {
  zh: string;
  en: string;
}

export interface PromptCategory {
  id: string;
  labelZh: string;
  labelEn: string;
  mode: OutputMode | "all";
  items: PromptItem[];
}

export const PROMPT_LIBRARY: PromptCategory[] = [
  // ─── TEXT MODE ──────────────────────────────────────────────────────────────
  {
    id: "content",
    labelZh: "内容创作",
    labelEn: "Content",
    mode: "text",
    items: [
      {
        zh: "为一款面向中小企业的 SaaS 项目管理工具撰写一篇 2000 字的深度博客文章，涵盖功能亮点、目标用户痛点和竞品对比。",
        en: "Write a 2000-word in-depth blog post for a SaaS project management tool targeting SMBs, covering key features, user pain points, and competitor comparison.",
      },
      {
        zh: "制定抖音/小红书 30 天短视频内容日历，含每日话题策划、推荐时长、发布时间和互动引导文案。",
        en: "Create a 30-day short video content calendar for TikTok/Instagram Reels with daily topics, recommended lengths, post times, and engagement copy.",
      },
      {
        zh: "撰写一条 AI 辅助写作工具的 60 秒口播脚本，风格轻松幽默，适合 25-35 岁职场用户，结尾带 CTA。",
        en: "Write a 60-second voiceover script for an AI writing assistant targeting 25–35 year-old professionals. Keep it light and witty, with a CTA at the end.",
      },
    ],
  },
  {
    id: "marketing",
    labelZh: "市场营销",
    labelEn: "Marketing",
    mode: "text",
    items: [
      {
        zh: "为一家主打「隐私优先」的搜索引擎制定品牌定位策略，分析目标受众、核心卖点、差异化主张和品牌声调。",
        en: "Develop a brand positioning strategy for a 'privacy-first' search engine: target audience, core value propositions, differentiation, and brand voice.",
      },
      {
        zh: "为线上英语培训课程写 5 套 Google 搜索广告文案（标题 + 描述），分别针对备考、职场晋升、出国留学三类用户。",
        en: "Write 5 sets of Google Search ad copy (headline + description) for an online English course targeting exam prep, career advancement, and study-abroad audiences.",
      },
      {
        zh: "制定一款新上线 B2B SaaS 工具的 90 天 PLG 增长策略，包括免费层设计、激活漏斗优化、裂变机制和关键指标。",
        en: "Create a 90-day PLG growth strategy for a newly launched B2B SaaS tool: free-tier design, activation funnel optimization, viral mechanics, and key metrics.",
      },
    ],
  },
  {
    id: "analysis",
    labelZh: "数据分析",
    labelEn: "Analysis",
    mode: "text",
    items: [
      {
        zh: "深度分析国内 AI 编程助手市场（Cursor/Copilot/通义灵码等），对比商业模式、用户规模、定价策略和技术壁垒，给出市场机会报告。",
        en: "Analyze the AI coding assistant market (Cursor, Copilot, Tongyi Lingma, etc.) comparing business models, user scale, pricing, and technical moats. Produce a market opportunity report.",
      },
      {
        zh: "设计一份针对独立创业者的定性用户访谈方案：访谈目标、筛选标准、核心问题列表（10 题）和分析框架。",
        en: "Design a qualitative user interview plan for solo founders: goals, screening criteria, a 10-question guide, and an analysis framework.",
      },
      {
        zh: "整理一份 2024-2025 年全球 AIGC 行业融资数据报告摘要，按赛道分类（文本/图像/视频/音乐/3D），分析头部玩家和资本偏好趋势。",
        en: "Summarize a 2024–2025 global AIGC funding report by category (text/image/video/music/3D), analyzing top players and investment preference trends.",
      },
    ],
  },
  {
    id: "strategy",
    labelZh: "商业策略",
    labelEn: "Strategy",
    mode: "text",
    items: [
      {
        zh: "为一家 AI 驱动的法律文件自动化平台制定中国市场进入战略：目标行业、初期切入点、监管风险、渠道合作和 GTM 节奏。",
        en: "Develop a China market entry strategy for an AI-driven legal document automation platform: target industries, initial wedge, regulatory risks, channel partnerships, and GTM cadence.",
      },
      {
        zh: "帮我撰写一份面向天使轮投资人的融资叙事文档（3-5 页），包括问题定义、解决方案、市场规模、商业模式、团队和资金用途。",
        en: "Write a 3–5 page seed-round fundraising narrative for angel investors covering problem, solution, market size, business model, team, and use of funds.",
      },
      {
        zh: "为一家月活 50 万的 AI 写作工具制定从免费版到付费版的转化策略，设计分层订阅方案和关键转化触点。",
        en: "Design a freemium-to-paid conversion strategy for an AI writing tool with 500K MAU: tiered subscription plans and key conversion trigger points.",
      },
    ],
  },

  // ─── AGENT (BUILD) MODE ──────────────────────────────────────────────────────
  {
    id: "backend",
    labelZh: "后端/API",
    labelEn: "Backend",
    mode: "agent",
    items: [
      {
        zh: "用 Python FastAPI 构建一个用户认证服务：注册/登录/JWT 刷新/密码重置接口，密码 bcrypt 加密，PostgreSQL 存储，含 Dockerfile 和 .env 示例。",
        en: "Build a user auth service with Python FastAPI: register/login/JWT refresh/password reset endpoints, bcrypt passwords, PostgreSQL storage, Dockerfile, and .env example.",
      },
      {
        zh: "设计并实现一个 Node.js + Prisma 的多租户 SaaS 后端骨架：租户隔离、RBAC 权限模型、审计日志、速率限制中间件。",
        en: "Design and implement a Node.js + Prisma multi-tenant SaaS backend scaffold with tenant isolation, RBAC, audit logging, and rate-limiting middleware.",
      },
      {
        zh: "用 Go + gRPC 构建一个高性能文件上传微服务，支持分片上传、断点续传、S3 对象存储集成和上传进度回调。",
        en: "Build a high-performance file upload microservice in Go + gRPC with chunked uploads, resumable transfers, S3 integration, and progress callbacks.",
      },
    ],
  },
  {
    id: "frontend",
    labelZh: "前端/UI",
    labelEn: "Frontend",
    mode: "agent",
    items: [
      {
        zh: "创建一个带实时折线图（Recharts）、WebSocket 数据推送和暗色主题的 React 监控 Dashboard，数据 mock 用随机波动模拟。",
        en: "Create a React monitoring dashboard with real-time line charts (Recharts), WebSocket data push, dark theme, and random-fluctuation mock data.",
      },
      {
        zh: "用 React + Framer Motion 构建一个 SaaS 产品落地页：Hero 区块、特性展示、价格对比表、FAQ 折叠、Waitlist 表单，完整响应式。",
        en: "Build a SaaS landing page with React + Framer Motion: Hero, features, pricing table, FAQ accordion, waitlist form — fully responsive.",
      },
      {
        zh: "实现一个 React 富文本编辑器组件（基于 Tiptap），支持 Markdown 快捷键、@提及、图片上传预览和协同光标占位。",
        en: "Implement a React rich text editor component using Tiptap with Markdown shortcuts, @mentions, image upload preview, and co-cursor placeholders.",
      },
    ],
  },
  {
    id: "datatools",
    labelZh: "数据工具",
    labelEn: "Data Tools",
    mode: "agent",
    items: [
      {
        zh: "构建一个 Python 爬虫工具，每日抓取主要电商平台（京东/淘宝/拼多多）指定商品的价格和库存，存入 SQLite，并用 matplotlib 绘制价格趋势图。",
        en: "Build a Python scraper that daily fetches prices and stock for target products on major e-commerce platforms, stores in SQLite, and plots price trends with matplotlib.",
      },
      {
        zh: "开发一个 CLI 数据 ETL 工具：从 CSV/JSON/Parquet 读取，支持列映射/过滤/聚合，写出到 PostgreSQL，含进度条和错误报告。",
        en: "Develop a CLI ETL tool that reads CSV/JSON/Parquet, supports column mapping/filtering/aggregation, and writes to PostgreSQL with progress bar and error report.",
      },
      {
        zh: "创建一个 Python 脚本，批量解析 Notion 导出的 Markdown 文件，提取标题/标签/创建时间，生成 JSON 知识图谱并导入 Elasticsearch。",
        en: "Create a Python script to batch-parse Notion exported Markdown files, extract titles/tags/timestamps, generate a JSON knowledge graph, and import to Elasticsearch.",
      },
    ],
  },
  {
    id: "aieng",
    labelZh: "AI 工程",
    labelEn: "AI Eng",
    mode: "agent",
    items: [
      {
        zh: "用 LangChain + Chroma + OpenAI 构建一个本地文档问答系统（RAG）：PDF 解析、分块嵌入、语义检索、带来源引用的回答生成，含 Streamlit UI。",
        en: "Build a local document Q&A system (RAG) with LangChain + Chroma + OpenAI: PDF parsing, chunked embedding, semantic retrieval, cited-answer generation, Streamlit UI.",
      },
      {
        zh: "开发一个 Python LLM 工具链：函数调用（Function Calling）+ 结构化输出（Pydantic）+ 多轮对话记忆 + 流式输出，支持 OpenAI 和 Anthropic 双后端。",
        en: "Develop a Python LLM toolchain: Function Calling + structured output (Pydantic) + multi-turn memory + streaming, supporting both OpenAI and Anthropic backends.",
      },
      {
        zh: "实现一个多 Agent 协作框架（AutoGen 风格）：Planner/Coder/Reviewer 三角色，任务自动分配，结果互审，最终输出合并报告。",
        en: "Implement a multi-agent collaboration framework (AutoGen-style): Planner/Coder/Reviewer roles, automatic task delegation, cross-review, and final merged report output.",
      },
    ],
  },

  // ─── QA MODE ─────────────────────────────────────────────────────────────────
  {
    id: "techprinciple",
    labelZh: "技术原理",
    labelEn: "Tech Deep-dive",
    mode: "qa",
    items: [
      {
        zh: "深入解释 Transformer 自注意力机制的数学原理（Q/K/V 矩阵、缩放点积、多头注意力），并说明它与 RNN/LSTM 相比解决了哪些问题。",
        en: "Deeply explain the math behind Transformer self-attention (Q/K/V matrices, scaled dot-product, multi-head attention) and what problems it solves vs. RNN/LSTM.",
      },
      {
        zh: "对比分析 PostgreSQL 与 MongoDB 在以下维度的权衡：ACID 保证、水平扩展、查询灵活性、Schema 设计、典型适用场景。",
        en: "Compare PostgreSQL and MongoDB across: ACID guarantees, horizontal scaling, query flexibility, schema design, and typical use cases.",
      },
      {
        zh: "解释 Kubernetes 中 Pod、Deployment、Service、Ingress 的层次关系，并说明一个典型微服务应用的完整部署拓扑。",
        en: "Explain the relationship between Kubernetes Pod, Deployment, Service, and Ingress, and describe the full deployment topology of a typical microservices app.",
      },
    ],
  },
  {
    id: "bizproduct",
    labelZh: "产品/商业",
    labelEn: "Product & Biz",
    mode: "qa",
    items: [
      {
        zh: "分析 Notion 从工具软件演变为「操作系统」级产品的增长路径：早期定位、病毒传播机制、网络效应、企业化转型节点。",
        en: "Analyze Notion's growth from a tool to an 'operating system' product: early positioning, viral mechanics, network effects, and enterprise pivot moments.",
      },
      {
        zh: "解释 SaaS 业务中 ARR、NRR、LTV/CAC、Magic Number、Rule of 40 这些核心指标的含义、计算方式及行业基准值。",
        en: "Explain the meaning, calculation, and industry benchmarks of key SaaS metrics: ARR, NRR, LTV/CAC, Magic Number, and Rule of 40.",
      },
      {
        zh: "AI 时代产品经理的核心竞争力是什么？与传统 PM 相比，AI PM 需要额外掌握哪些技能？给出你的系统性分析。",
        en: "What are the core competencies of a product manager in the AI era? What additional skills does an AI PM need vs. a traditional PM? Give a systematic analysis.",
      },
    ],
  },
  {
    id: "learning",
    labelZh: "学习概念",
    labelEn: "Learning",
    mode: "qa",
    items: [
      {
        zh: "用类比的方式解释 RAG（检索增强生成）和 Fine-tuning 的核心区别，什么场景适合用 RAG，什么场景适合微调？",
        en: "Use analogies to explain the core difference between RAG and fine-tuning. When should you use RAG vs. fine-tuning?",
      },
      {
        zh: "我想从零开始学习系统设计，请给我一份 3 个月学习路线图，包括核心概念、推荐资源、练习方式和里程碑检验方法。",
        en: "Give me a 3-month zero-to-hero system design learning roadmap: core concepts, recommended resources, practice methods, and milestone checkpoints.",
      },
      {
        zh: "短视频算法的推荐逻辑是什么？从内容冷启动、完播率/互动权重、用户画像匹配到流量分层，给我一个完整的解释框架。",
        en: "What is the recommendation logic of short video algorithms? Give a complete explanatory framework covering cold start, completion rate/engagement weights, user profiling, and traffic tiering.",
      },
    ],
  },

  // ─── IMAGE MODE ───────────────────────────────────────────────────────────────
  {
    id: "commercial",
    labelZh: "商业设计",
    labelEn: "Commercial",
    mode: "image",
    items: [
      {
        zh: "极简主义科技感 Logo 设计，深蓝色渐变背景，中心是一个抽象的「∞」符号由光粒子构成，适合 AI/区块链创业公司，正方形构图。",
        en: "Minimalist tech-style logo design, deep blue gradient background, center features an abstract '∞' symbol made of light particles, suitable for AI/blockchain startup, square composition.",
      },
      {
        zh: "竖版 9:16 短视频封面，科技感深色背景，顶部有「AI 周报」字样，下方是立体感的神经网络节点图，霓虹蓝紫色调，适合科技媒体账号。",
        en: "Vertical 9:16 short video cover, dark tech background, 'AI Weekly' title at top, 3D neural network node illustration below, neon blue-purple palette, suited for tech media accounts.",
      },
      {
        zh: "产品展示图：一款高端无线降噪耳机漂浮在深灰色背景中，柔和的侧面光源，投影在背景上的光晕，呈现奢华质感，类似苹果产品宣传图风格。",
        en: "Product showcase: premium wireless noise-canceling headphones floating on a dark gray background, soft side-lighting with a halo shadow, luxurious Apple-campaign aesthetic.",
      },
    ],
  },
  {
    id: "artistic",
    labelZh: "艺术风格",
    labelEn: "Artistic",
    mode: "image",
    items: [
      {
        zh: "赛博朋克风格的东京夜景，2077 年，高楼外墙全是霓虹广告牌，雨后积水地面倒映出绚烂灯光，街边有蒸汽从下水道冒出，电影感宽幅构图，超细节。",
        en: "Cyberpunk Tokyo nightscape, year 2077, skyscrapers covered in neon ads, rain-soaked streets reflecting brilliant lights, steam rising from manholes, cinematic widescreen, ultra-detailed.",
      },
      {
        zh: "工笔重彩风格的中国山水画，远山云雾缭绕，近景是一片金色竹林，溪流蜿蜒其间，落日余晖将整个画面染成橙红色，构图饱满细腻。",
        en: "Chinese fine-brush gongbi painting style, distant mountains shrouded in mist, foreground golden bamboo grove, winding stream, sunset painting the scene orange-red, rich and detailed composition.",
      },
      {
        zh: "极简主义黑白抽象插画，大量留白，中心是一根笔触凌厉的毛笔线条形成的漩涡，日本禅意美学风格，适合品牌海报。",
        en: "Minimalist black-and-white abstract illustration, generous whitespace, a single bold ink brushstroke forms a spiral at the center, Japanese Zen aesthetic, suitable for brand poster.",
      },
    ],
  },
  {
    id: "scene",
    labelZh: "场景/环境",
    labelEn: "Scene",
    mode: "image",
    items: [
      {
        zh: "深海中的神秘生物，通体半透明发出蓝绿色冷光，周围是漂浮的水母群，黑暗背景中生物发光的粒子构成壮观的视觉，电影级超高清光影。",
        en: "Mysterious deep-sea creature, semi-transparent body emitting cold blue-green bioluminescence, surrounded by floating jellyfish, particle bioluminescence against pitch-black background, cinematic ultra-HD lighting.",
      },
      {
        zh: "未来城市的空中花园，2150 年，玻璃和钢铁高楼之间生长着大型热带植被，直升飞行器穿梭其间，软金色日光透过云层照射，广角航拍视角。",
        en: "Future city sky garden, year 2150, tropical vegetation growing between glass-and-steel skyscrapers, personal air vehicles weaving through, soft golden light through clouds, wide-angle aerial view.",
      },
      {
        zh: "冰岛极光下的孤独教堂，雪地反光，北极光绿紫渐变横贯天际，远处是黑色火山岩山脉，长曝光摄影风格，星轨清晰可见。",
        en: "Lonely church under Icelandic Northern Lights, snow-reflected foreground, green-to-purple aurora arcing across the sky, black volcanic mountain range in distance, long-exposure photography with visible star trails.",
      },
    ],
  },
];
