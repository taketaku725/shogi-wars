// 共通定数・ヘルパ
export const SENTE = "sente";
export const GOTE  = "gote";

export const PROMOTABLE = new Set(["FU","KYO","KEI","GIN","KAKU","HISHA"]);
export const PROMOTED_LABEL = { FU:"と", KYO:"成香", KEI:"成桂", GIN:"成銀", KAKU:"馬", HISHA:"龍" };
export const TYPE_LABEL     = { FU:"歩", KYO:"香", KEI:"桂", GIN:"銀", KIN:"金", KAKU:"角", HISHA:"飛", OU:"玉" };

export const VALUE = { FU:1, KYO:3, KEI:3, GIN:5, KIN:6, KAKU:8, HISHA:10, OU:10000 };
export const PROMO_BONUS = { FU:0.8, KYO:0.8, KEI:0.8, GIN:0.6, KAKU:1.5, HISHA:1.5 };

export const opponent = (p)=> p===SENTE ? GOTE : SENTE;
export const dirOf = (owner)=> owner===SENTE ? -1 : +1;
export const inBounds = (r,c)=> r>=0 && r<9 && c>=0 && c<9;
export const promotionZone = (owner, row)=> owner===SENTE ? (row<=2) : (row>=6);

export const deepCopy = (o)=> JSON.parse(JSON.stringify(o));

export function labelForPiece(p){
  if(p.type==="OU") return p.owner===SENTE ? "王" : "玉";
  return p.promoted ? (PROMOTED_LABEL[p.type] || TYPE_LABEL[p.type]) : TYPE_LABEL[p.type];
}
