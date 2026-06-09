import React from 'react';
export const GameResultOverlay=(p:any)=>{
 if(!p.isOpen)return null;
 const title=React.createElement('h2',null,p.title);
 const sub=p.subtitle?React.createElement('p',null,p.subtitle):null;
 const det=p.details?React.createElement('div',null,p.details):null;
 return React.createElement('div',null,title,sub,det);
};
