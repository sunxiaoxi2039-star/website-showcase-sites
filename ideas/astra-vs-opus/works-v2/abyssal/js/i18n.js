// ES Module 侧的语言工具：读 lang-boot.js 设好的状态。
export const lang = () => (window.AVO_LANG ? window.AVO_LANG.get() : (document.documentElement.lang.startsWith('en') ? 'en' : 'zh'));
export const isEn = () => lang() === 'en';
// L('中文', 'English')
export const L = (zh, en) => (isEn() ? en : zh);
// 双语对象 {zh, en} 或普通字符串
export const tx = (v) => (v && typeof v === 'object' ? (isEn() ? v.en : v.zh) ?? v.zh : v);
export const onLang = (fn) => window.addEventListener('avo:lang', () => fn(lang()));
