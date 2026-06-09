import React from 'react';
export const GameResultOverlay=(p:any)=>{
 if(!p.isOpen)return null;
 const a={onPointerUp:p.onPrimary};
 const b={onPointerUp:p.onSecondary};
 return React.createElement('div',null,
  React.createElement('h2',null,p.title),
  p.subtitle&&React.createElement('p',null,p.subtitle),
  p.details&&React.createElement('div',null,p.details),
  React.createElement('button',a,p.primaryLabel||'Again'),
  p.onSecondary&&React.create