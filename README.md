# 小冰块 - 个人摄影集

我的个人摄影网站，用来展示旅途中拍下的照片。每组照片按城市和时间整理成一个作品集，配上简短的文字。

在线查看：[icypic.vercel.app](https://icypic.vercel.app)

## 功能

- 首页轮播 + 卡片式作品集浏览（支持翻转、浮动等多种卡片动画）
- 作品集详情页，支持图文混排和灯箱大图浏览
- 足迹地图页，可视化去过的城市
- 关于页
- 后台管理：作品集增删改、照片批量上传、首页布局拖拽排序
- 数据通过 IndexedDB 本地持久化，支持 Supabase 云同步
- 响应式，手机和电脑端都能用

## 技术栈

- React 18 + TypeScript
- React Router 6
- Framer Motion（页面过渡动画）
- Leaflet（足迹地图）
- Supabase（云端数据同步）
- Cloudflare R2（图片存储）
- 部署在 Vercel

## 本地开发

```bash
npm install
npm start
```

启动后访问 http://localhost:3000

构建生产版本：

```bash
npm run build
```

## 项目结构

```
src/
├── components/       # Header、Footer、错误边界等公共组件
├── pages/            # Home、Gallery、Footprints、About、Admin
├── context/          # DataContext（全局数据管理）
├── hooks/            # 自定义 hooks
├── types/            # TypeScript 类型
├── utils/            # Supabase、存储、图床等工具函数
└── data/             # 默认数据
```

## 部署

项目部署在 Vercel，推送到 main 分支后自动构建。`vercel.json` 中配置了 SPA 路由回退和 API 代理。

## License

MIT
