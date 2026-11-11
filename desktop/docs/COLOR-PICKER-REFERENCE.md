# MCHOSE 原生配色按钮只读参考

官方组件：`DeviceCardColorSelector`，scope=`data-v-69efa718`。
本机缓存：`%LOCALAPPDATA%/One4All-Desktop/vendor-resources/mchose/source/app.js`，组件字符区间 2390589–2396780。
CSS URL：https://cdn.mchose.com.cn/customPage/prod/assets/main-DAJLKlVu.css
CSS SHA256：324c5974672ef46c3c41a0a25f964380c2ce2c853da4c6ba9346b19b0fced0aa

沉浸式模式的触发器内部是一个 span，背景直接来自当前产品 swatchBackground 或 swatchClass。外层 du-coachmark 在 hover 时显示多色菜单。该触发器没有 before/after 珠光图层，没有黑白太极底图，也没有固定金色。只有部分产品色块本身使用金黑/白金渐变或原厂纹理图片。

## 原始基础规则

```css
/* character offset 28452 */
.device-card-main[data-v-69efa718]{--device-card-swatch-size: 12px;--device-card-swatch-hit: 12px;display:flex;flex:1 1 0%;flex-direction:column;gap:var(--du-gap-16)}
/* character offset 28859 */
.device-card-main .device-card-switch button[data-v-69efa718],.device-card-main .device-card-switch-trigger[data-v-69efa718]{display:block}
/* character offset 28998 */
.device-card-main .device-card-switch button[data-v-69efa718],.device-card-main .device-card-switch-trigger[data-v-69efa718]{cursor:pointer}
/* character offset 29138 */
.device-card-main .device-card-switch button[data-v-69efa718],.device-card-main .device-card-switch-trigger[data-v-69efa718]{border-width:0px}
/* character offset 29280 */
.device-card-main .device-card-switch button[data-v-69efa718],.device-card-main .device-card-switch-trigger[data-v-69efa718]{padding:0}
/* character offset 29415 */
.device-card-main .device-card-switch button[data-v-69efa718],.device-card-main .device-card-switch-trigger[data-v-69efa718]{width:var(--device-card-swatch-size);height:var(--device-card-swatch-size);border-radius:var(--du-radius-round-corner-full)}
/* character offset 31201 */
.device-card-main.is-immersive[data-v-69efa718]{--device-card-swatch-size: 10px;--device-card-swatch-hit: 14px;margin-top:25px;min-height:0;gap:0}
/* character offset 31496 */
.device-card-main.is-immersive .device-card-color-coachmark[data-v-69efa718]{line-height:0}
/* character offset 31587 */
.device-card-main.is-immersive .device-card-color-coachmark[data-v-69efa718]::part(popper){position:absolute!important;top:auto!important;bottom:100%;left:50%!important;transform:translate(-50%)}
/* character offset 31782 */
.device-card-main.is-immersive .device-card-color-coachmark[data-v-69efa718]::part(body){padding:6px 8px;border-radius:var(--du-radius-round-corner-full);cursor:pointer}
/* character offset 31951 */
.device-card-main.is-immersive .device-card-color-coachmark[data-v-69efa718]::part(arrow){display:none}
/* character offset 32054 */
.device-card-main.is-immersive .device-card-switch-trigger[data-v-69efa718]{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:0;background:transparent}
/* character offset 32247 */
.device-card-main.is-immersive .device-card-switch-trigger span[data-v-69efa718]{display:block;width:var(--device-card-swatch-size);height:var(--device-card-swatch-size);border-radius:var(--du-radius-round-corner-full)}
/* character offset 35715 */
.device-card-switch div .k7-color-gray[data-v-69efa718],.device-card-switch-trigger .k7-color-gray[data-v-69efa718]{background:#c9be9d}
/* character offset 44066 */
.device-card-switch div .v7-pro-color-yellow[data-v-69efa718],.device-card-switch-trigger .v7-pro-color-yellow[data-v-69efa718]{background:#f0bc22}
```

## 实际配色例子

- white: #fff；黑色 #151515。
- color-white-black: linear-gradient(180deg,#000 30%,#fff 70%)。
- color-black-golden: linear-gradient(180deg,#f0c04b,#000)。
- color-white-yellow: linear-gradient(180deg,#fff,#dac6a8)。
- color-black-yellow: linear-gradient(180deg,#cdb997,#151515)。
- color-ace75-black-gold 使用 https://cdn.mchose.com.cn/configCenter/static/images/Ace75BlackGoldColor_c8a24g5b63dw3fgm.png ，这是色块纹理，不是产品图。

本次未启动/关闭任何进程、未改官方应用、未改 One4All 应用、未编译。