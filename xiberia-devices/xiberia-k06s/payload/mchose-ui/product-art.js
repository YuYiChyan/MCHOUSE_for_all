/* SPDX-License-Identifier: MIT. Image rights are documented separately in each device package. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.One4AllProductArt=factory();
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const catalog={
    g309:[
      {id:'g309',label:'黑色',swatch:'#202124',file:'g309-black.png'},
      {id:'g309-white',label:'白色',swatch:'#f2f2f2',file:'g309-white.png'},
    ],
    blackshark:[
      {id:'blackshark',label:'黑色',swatch:'#202124',file:'blackshark-black.png'},
      {id:'blackshark-green',label:'绿色',swatch:'#50e600',file:'blackshark-green.png'},
      {id:'blackshark-white',label:'白色',swatch:'#f2f2f2',file:'blackshark-white.png'},
    ],
  };
  for(const options of Object.values(catalog)){for(const item of options)Object.freeze(item);Object.freeze(options);}
  Object.freeze(catalog);
  function select(id,color){const options=catalog[id];if(!options)throw Error('Unknown product');return options.find(option=>option.id===color)||options[0];}
  return Object.freeze({catalog,select});
});
