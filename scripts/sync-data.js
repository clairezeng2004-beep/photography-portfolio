#!/usr/bin/env node
/**
 * sync-data.js
 * 读取导出的 portfolio-data.json，将数据同步写入源文件：
 *   - src/data/mockData.ts（作品集数据）
 *   - src/context/DataContext.tsx（aboutInfo 默认值、heroImages 等）
 *
 * 用法：
 *   1. 在 Admin 页面点击"导出数据"按钮，保存 portfolio-data.json 到项目根目录
 *   2. 运行 node scripts/sync-data.js
 *   3. 然后正常 npm run build 即可
 *
 * 也可以直接：npm run sync && npm run build
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'portfolio-data.json');
const MOCK_DATA_FILE = path.join(ROOT, 'src', 'data', 'mockData.ts');
const DATA_CONTEXT_FILE = path.join(ROOT, 'src', 'context', 'DataContext.tsx');

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('⚠️  未找到 portfolio-data.json，跳过数据同步（将使用现有默认数据）');
    process.exit(0);
  }

  console.log('📦 正在读取 portfolio-data.json ...');
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);

  const { collections, aboutInfo, litCities, heroImages } = data;

  // 1. 写入 mockData.ts
  if (collections && collections.length > 0) {
    console.log(`📝 写入 ${collections.length} 个作品集到 mockData.ts ...`);
    const collectionsJson = JSON.stringify(collections, null, 2);
    const mockContent = `import { PhotoCollection } from '../types';

export const mockCollections: PhotoCollection[] = ${collectionsJson};
`;
    fs.writeFileSync(MOCK_DATA_FILE, mockContent, 'utf-8');
  }

  // 2. 更新 DataContext.tsx 中的默认数据
  let contextContent = fs.readFileSync(DATA_CONTEXT_FILE, 'utf-8');

  if (aboutInfo) {
    console.log('📝 更新 DataContext.tsx 中的 defaultAboutInfo ...');
    const aboutJson = JSON.stringify(aboutInfo, null, 2);
    contextContent = contextContent.replace(
      /const defaultAboutInfo: AboutInfo = \{[\s\S]*?\n\};/,
      `const defaultAboutInfo: AboutInfo = ${aboutJson};`
    );
  }

  // 写回 DataContext.tsx
  fs.writeFileSync(DATA_CONTEXT_FILE, contextContent, 'utf-8');

  // 3. 如果有 heroImages，注入到 DataContext 的初始 state
  // heroImages 在 DataContext 中是从 IndexedDB 加载的，默认是空数组
  // 我们在 loadData 的 heroImages 分支中注入默认值
  if (heroImages && heroImages.length > 0) {
    console.log(`📝 注入 ${heroImages.length} 张 Hero 图片默认值 ...`);
    const heroJson = JSON.stringify(heroImages, null, 2);

    // 查找并替换 heroImages 的加载逻辑中的空数组回退
    let ctx = fs.readFileSync(DATA_CONTEXT_FILE, 'utf-8');

    // 添加或替换 defaultHeroImages 常量
    if (ctx.includes('const defaultHeroImages')) {
      ctx = ctx.replace(
        /const defaultHeroImages: HeroImage\[\] = \[[\s\S]*?\];/,
        `const defaultHeroImages: HeroImage[] = ${heroJson};`
      );
    } else {
      // 在 defaultAnimationConfig 前插入
      ctx = ctx.replace(
        'const defaultAnimationConfig: AnimationConfig = {',
        `const defaultHeroImages: HeroImage[] = ${heroJson};\n\nconst defaultAnimationConfig: AnimationConfig = {`
      );
    }

    // 确保 heroImages 初始 state 使用 defaultHeroImages
    ctx = ctx.replace(
      /const \[heroImages, setHeroImages\] = useState<HeroImage\[\]>\(\[\]\);/,
      'const [heroImages, setHeroImages] = useState<HeroImage[]>(defaultHeroImages);'
    );

    // 在加载 hero 的地方，如果 IndexedDB 没数据也使用默认值
    if (!ctx.includes('setHeroImages(defaultHeroImages)')) {
      ctx = ctx.replace(
        /const savedHero = await dbGet<HeroImage\[\]>\('hero_images'\);\s*\n\s*if \(savedHero && savedHero\.length > 0\) \{\s*\n\s*setHeroImages\(savedHero\);\s*\n\s*\}/,
        `const savedHero = await dbGet<HeroImage[]>('hero_images');
        if (savedHero && savedHero.length > 0) {
          setHeroImages(savedHero);
        } else {
          setHeroImages(defaultHeroImages);
          await dbSet('hero_images', defaultHeroImages);
        }`
      );
    }

    fs.writeFileSync(DATA_CONTEXT_FILE, ctx, 'utf-8');
  }

  // 4. 如果有 litCities，也注入
  if (litCities && litCities.length > 0) {
    console.log(`📝 注入 ${litCities.length} 个点亮城市 ...`);
    let ctx = fs.readFileSync(DATA_CONTEXT_FILE, 'utf-8');
    const citiesJson = JSON.stringify(litCities, null, 2);

    if (ctx.includes('const defaultLitCities')) {
      ctx = ctx.replace(
        /const defaultLitCities: GeoInfo\[\] = \[[\s\S]*?\];/,
        `const defaultLitCities: GeoInfo[] = ${citiesJson};`
      );
    } else {
      ctx = ctx.replace(
        'const defaultAnimationConfig: AnimationConfig = {',
        `const defaultLitCities: GeoInfo[] = ${citiesJson};\n\nconst defaultAnimationConfig: AnimationConfig = {`
      );
    }

    ctx = ctx.replace(
      /const \[litCities, setLitCities\] = useState<GeoInfo\[\]>\(\[\]\);/,
      'const [litCities, setLitCities] = useState<GeoInfo[]>(defaultLitCities);'
    );

    fs.writeFileSync(DATA_CONTEXT_FILE, ctx, 'utf-8');
  }

  console.log('✅ 数据同步完成！现在可以运行 npm run build 了。');
}

main();
