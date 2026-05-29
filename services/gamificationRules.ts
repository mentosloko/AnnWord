import { CharacterMood, CharacterStage, PetState } from '../types';
import { ECONOMY_COIN_REWARDS as C } from './economyConfig';
export type GameRewardInput = any;
export type GameRewardResult = any;
export type CharacterProgressResult = any;
const T=[0,120,300,600,1000,1500,2200,3000,4000,5200,6800,8600];
const cl=(v:number,a=0,b=100)=>Math.max(a,Math.min(b,Math.round(v)));
const st=(l:number):CharacterStage=>l>=10?'stage_4':l>=7?'stage_3':l>=4?'stage_2':'stage_1';
export const getTotalXpForLevel=(l:number)=>{const n=Math.max(1,Math.round(l||1));if(n<=T.length)return T[n-1];const e=n-T.length;return T[T.length-1]+e*2000+e*(e-1)*150};
export const CHARACTER_LEVEL_THRESHOLDS=Array.from({length:20},(_,i)=>({level:i+1,totalXp:getTotalXpForLevel(i+1),stage:st(i+1)}));
export const deriveCharacterLevel=(xp:number)=>{let l=1;while(l<100&&Math.max(0,Math.round(xp||0))>=getTotalXpForLevel(l+1))l++;return l};
export const deriveCharacterStage=(l:number)=>st(l);
export const getCharacterStageLabel=(s?:CharacterStage)=>({stage_1:'Малыш',stage_2:'Юный исследователь',stage_3:'Знаток слов',stage_4:'Мастер слов'}[s||'stage_1']);
export const deriveMoodFromScore=(n:number):CharacterMood=>{const v=cl(n);return v<=20?'sad':v<=45?'calm':v<=70?'happy':v<=90?'joyful':'super_happy'};
export const normalizeMoodScore=(p:PetState)=>typeof p.moodScore==='number'?cl(p.moodScore):({sad:15,neutral:40,calm:40,happy:60,excited:80,joyful:80,super_happy:95}[p.mood]||50);
export const getNextLevelThreshold=(l:number)=>getTotalXpForLevel(l+1);
export const getCurrentLevelThreshold=(l:number)=>getTotalXpForLevel(l);
export const calculateGameReward=(i:GameRewardInput):GameRewardResult=>{const a=Math.round(i.coinsAdjustment||0),r=(xp:number,c:number,m:number,label:string)=>({xp,coins:c+a,mood:m,label});
if(i.type==='wordle')return i.won?r(25,C.wordle.win,12,'Wordle win'):r(8,C.wordle.loss,8,'Wordle done');
if(i.type==='sprint'){const n=Math.max(0,Math.round(i.guessedWords||0)),x=n?Math.min(30,n*5):5;return r(x,n>=6?C.sprint.great:n>=3?C.sprint.good:C.sprint.low,Math.min(12,x),'Sprint done')}
if(i.type==='anagram'){const n=Math.max(0,Math.round(i.guessedWords||0)),x=n?Math.min(25,n*5):5;return r(x,C.anagram.success,Math.min(10,x),'Anagram done')}
if(i.type==='memory'){const n=Math.max(0,Math.round(i.clicks||0)),x=n>0&&n<=12?30:n<=16?25:n<=20?20:n<=24?15:n>24?10:8;return r(x,n>0&&n<=16?C.memory.great:n<=24?C.memory.good:C.memory.low,Math.min(12,x),'Memory done')}
if(i.type==='hangman'){const w=!!i.won,m=Math.max(1,Math.round(i.maxMistakes||7)),e=Math.max(0,Math.min(m,Math.round(i.mistakes||0))),x=w?25+Math.min(10,m-e):8;return r(x,w?(e<=1?C.hangman.perfect:C.hangman.win):C.hangman.loss,Math.min(14,x),'Hangman done')}
return r(0,0,0,'Done')};
export const applyGameRewardToCharacter=(p:PetState,r:any):CharacterProgressResult=>{const previousLevel=deriveCharacterLevel(p.xp||0),xp=Math.max(0,Math.round(p.xp||0))+Math.max(0,Math.round(r.xp||0)),newLevel=deriveCharacterLevel(xp),moodScore=Math.min(70,normalizeMoodScore(p)+Math.max(0,Math.round(r.mood||0))),pet={...p,xp,level:newLevel,stage:st(newLevel),moodScore,mood:deriveMoodFromScore(moodScore)};return{pet,previousLevel,newLevel,previousStage:st(previousLevel),newStage:st(newLevel),leveledUp:newLevel>previousLevel,stagedUp:st(newLevel)!==st(previousLevel)}};
export const applyTreatMood=(p:PetState,d:number,_cap?:number):PetState=>{const moodScore=Math.min(100,normalizeMoodScore(p)+Math.max(0,Math.round(d||0)));return{...p,moodScore,mood:deriveMoodFromScore(moodScore)}};
export const getCharacterProgressText=(p:PetState)=>`До следующего уровня: ${Math.max(0,getNextLevelThreshold(deriveCharacterLevel(p.xp||0))-(p.xp||0))} очков опыта`;
export const getCharacterProgressPercent=(p:PetState)=>{const l=deriveCharacterLevel(p.xp||0),a=getCurrentLevelThreshold(l),b=getNextLevelThreshold(l);return b<=a?100:cl(((p.xp||0)-a)/(b-a)*100)};
