/*! Fake bundle for watch.test.js: one minified-looking line per item of items.json, written the way
    terser prints CCFOLIA's React + MUI v5 code. Not CCFOLIA's code; nothing here runs. */
!function(){"use strict";var e={NODE_ENV:"production",PUBLIC_URL:"",REACT_APP_VERSION:"1.37.4"};
var R=[{path:"/rooms/:roomId",element:a},{path:"/rooms/:roomId/characters/:characterId",element:b},{path:"/rooms/:roomId/chat",element:c}];
var sn=(0,r.Z)("MuiSnackbar",["root","anchorOriginTopCenter","anchorOriginBottomCenter","anchorOriginTopRight"]);
var bd=(0,r.Z)("MuiBadge",["root","badge","dot","standard","anchorOriginTopRight","anchorOriginBottomRight","invisible","colorPrimary","colorSecondary"]);
var av=(0,r.Z)("MuiAvatar",["root","colorDefault","circular","rounded","square","img","fallback"]);
var ag=(0,r.Z)("MuiAvatarGroup",["root","avatar"]);
var dr=(0,r.Z)("MuiDrawer",["root","docked","paper","paperAnchorLeft","paperAnchorRight","modal"]);
var li=(0,r.Z)("MuiListItem",["root","container","focusVisible","dense","alignItemsFlexStart","disabled","divider","gutters","padding","button","secondaryAction","selected"]);
var la=(0,r.Z)("MuiListItemAvatar",["root","alignItemsFlexStart"]);
var lt=(0,r.Z)("MuiListItemText",["root","multiline","dense","inset","primary","secondary"]);
var ty=(0,r.Z)("MuiTypography",["root","h1","h2","h3","h4","h5","h6","subtitle1","subtitle2","body1","body2","inherit","button","caption","overline","noWrap","gutterBottom","paragraph"]);
var tb=(0,r.Z)("MuiToolbar",["root","gutters","regular","dense"]);
var ib=(0,r.Z)("MuiIconButton",["root","disabled","colorInherit","colorPrimary","edgeStart","edgeEnd","sizeSmall"]);
var pp=(0,r.Z)("MuiPaper",["root","rounded","outlined","elevation","elevation0","elevation6"]);
var ts=(0,r.Z)("MuiTabs",["root","vertical","flexContainer","centered","scroller","fixed","scrollableX","hideScrollbar","scrollButtons","indicator"]);
var tt=(0,r.Z)("MuiTab",["root","labelIcon","textColorInherit","textColorPrimary","selected","disabled","fullWidth","wrapped","iconWrapper"]);
var gs={active:"active",checked:"checked",completed:"completed",disabled:"disabled",error:"error",expanded:"expanded",focused:"focused",focusVisible:"focusVisible",open:"open",readOnly:"readOnly",required:"required",selected:"selected"};
var tr=(0,r.Z)("MuiTouchRipple",["root","ripple","rippleVisible","ripplePulsate","child","childLeaving","childPulsate"]);
var bx=(0,i.Z)({themeId:o.Z,defaultTheme:s,defaultClassName:"MuiBox-root",generateClassName:l.Z.generate});
function TL(e){return(0,c.jsx)("div",{className:e.className,role:"tablist",children:e.children})}
function SB(e){return(0,c.jsx)("div",{variant:"bar",children:e.items.slice(0,8).map(function(e){return(0,c.jsx)(Q,{item:e},e._id)})})}
function SV(e){var t=e.value/e.max;return(0,c.jsxs)(u.Z,{variant:"body2",noWrap:!0,children:[(0,c.jsx)("span",{color:t<=.8?"secondary":void 0,children:e.value}),"/",e.max]})}
function CL(e){var t=(0,f.MG)({count:e.messages.length,getScrollElement:function(){return e.ref.current},estimateSize:function(){return 72},overscan:50});return(0,c.jsx)(h.Z,{role:"log",children:t.getVirtualItems().map(function(e){return(0,c.jsx)("div",{"data-index":e.index,ref:t.measureElement},e.key)})})}
function MB(e){return(0,c.jsx)(m.Z,{direction:"up",in:e.open,children:(0,c.jsxs)(p.Z,{elevation:6,role:"status","aria-live":"polite","aria-label":e.label,children:e.children})})}
var TH=(0,d.Z)({palette:{mode:"dark",primary:{main:"#2196f3"},secondary:{main:"#dc004e"}}});
var DJ="__data.json",TK=".token",MV={meta:{version:"1.1.0"},entities:{},resources:{}};
function HX(e){return crypto.subtle.digest("SHA-256",e)}
var MT={"image/png":["png"],"image/jpeg":["jpeg","jpg","jpe"],"image/gif":["gif"],"image/webp":["webp"]};
var IF=["backgroundUrl","foregroundUrl","coverImageUrl","imageUrl","iconUrl","thumbnail"];
}();
