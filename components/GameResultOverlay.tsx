import React from 'react';
export const GameResultOverlay=(p:any)=>{
 if(!p.isOpen)return null;
 return React.createElement('div',null,
  React.createElement('h2',null,p.title),
  p.subtitle&&React.createElement('p',null,p.subtitle),
  p.details&&React.createElement('div',null,p.details),
  React.createElement('button',{onClick:p.onPrimary},p.primaryLabel||'Again'),
  p.onSecondary&&React.createElement('button',{onClick