import { SENTE, GOTE, opponent, dirOf, inBounds, promotionZone, PROMOTABLE } from "./util.js";

// 盤の初期配置
export function initialBoard(){
  const b = Array.from({length:9},()=>Array(9).fill(null));
  const put = (r,c,type,owner)=> b[r][c] = {type, owner, promoted:false};
  // 後手
  put(0,0,"KYO",GOTE); put(0,1,"KEI",GOTE); put(0,2,"GIN",GOTE); put(0,3,"KIN",GOTE);
  put(0,4,"OU", GOTE); put(0,5,"KIN",GOTE); put(0,6,"GIN",GOTE); put(0,7,"KEI",GOTE); put(0,8,"KYO",GOTE);
  put(1,1,"KAKU",GOTE); put(1,7,"HISHA",GOTE);
  for(let c=0;c<9;c++) put(2,c,"FU",GOTE);
  // 先手
  put(8,0,"KYO",SENTE); put(8,1,"KEI",SENTE); put(8,2,"GIN",SENTE); put(8,3,"KIN",SENTE);
  put(8,4,"OU", SENTE); put(8,5,"KIN",SENTE); put(8,6,"GIN",SENTE); put(8,7,"KEI",SENTE); put(8,8,"KYO",SENTE);
  put(7,7,"KAKU",SENTE); put(7,1,"HISHA",SENTE);
  for(let c=0;c<9;c++) put(6,c,"FU",SENTE);
  return b;
}

export function findKing(board, owner){
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){
    const p = board[r][c]; if(p && p.owner===owner && p.type==="OU") return {r,c};
  }
  return null;
}

function rays(board, r, c, deltas, owner){
  const out=[];
  for(const [dr,dc] of deltas){
    let nr=r+dr, nc=c+dc;
    while(inBounds(nr,nc)){
      const t=board[nr][nc];
      if(!t){ out.push({r:nr,c:nc}); }
      else{ if(t.owner!==owner) out.push({r:nr,c:nc}); break; }
      nr+=dr; nc+=dc;
    }
  }
  return out;
}
function stepIfFreeOrEnemy(board, r, c, owner){
  if(!inBounds(r,c)) return null;
  const t=board[r][c];
  if(!t || t.owner!==owner) return {r,c};
  return null;
}
function kingMoves(board, r, c, owner){
  const out=[];
  for(let dr=-1;dr<=1;dr++){
    for(let dc=-1;dc<=1;dc++){
      if(dr===0 && dc===0) continue;
      const m = stepIfFreeOrEnemy(board, r+dr, c+dc, owner);
      if(m) out.push(m);
    }
  }
  return out;
}
function goldMoves(board, r, c, owner){
  const d = dirOf(owner);
  const cand = [[r+d,c],[r,c+1],[r,c-1],[r-d,c],[r+d,c+1],[r+d,c-1]];
  const out=[]; for(const [nr,nc] of cand){ const m = stepIfFreeOrEnemy(board, nr,nc, owner); if(m) out.push(m); }
  return out;
}
function silverMoves(board, r, c, owner){
  const d = dirOf(owner);
  const steps = [[d,0],[d,1],[d,-1],[-d,1],[-d,-1]];
  const out=[]; for(const [dr,dc] of steps){ const m = stepIfFreeOrEnemy(board, r+dr, c+dc, owner); if(m) out.push(m); }
  return out;
}
function knightMoves(board, r, c, owner){
  const d = dirOf(owner);
  const out=[]; for(const [nr,nc] of [[r+2*d,c-1],[r+2*d,c+1]]){ const m = stepIfFreeOrEnemy(board, nr,nc, owner); if(m) out.push(m); }
  return out;
}
function dragonMoves(board, r, c, owner){
  const rook = rays(board, r, c, [[1,0],[-1,0],[0,1],[0,-1]], owner);
  const diagSteps = [[1,1],[1,-1],[-1,1],[-1,-1]];
  const step = diagSteps.map(([dr,dc])=> stepIfFreeOrEnemy(board, r+dr, c+dc, owner)).filter(Boolean);
  return rook.concat(step);
}
function horseMoves(board, r, c, owner){
  const bishop = rays(board, r, c, [[1,1],[1,-1],[-1,1],[-1,-1]], owner);
  const orthoSteps = [[1,0],[-1,0],[0,1],[0,-1]];
  const step = orthoSteps.map(([dr,dc])=> stepIfFreeOrEnemy(board, r+dr, c+dc, owner)).filter(Boolean);
  return bishop.concat(step);
}

export function pieceMoves(board, r, c){
  const p = board[r][c]; if(!p) return [];
  const owner = p.owner;

  if(p.type==="OU") return kingMoves(board,r,c,owner);
  if(p.promoted && ["FU","KYO","KEI","GIN"].includes(p.type)) return goldMoves(board,r,c,owner);
  if(p.promoted && p.type==="KAKU")  return horseMoves(board,r,c,owner);
  if(p.promoted && p.type==="HISHA") return dragonMoves(board,r,c,owner);

  if(p.type==="GIN") return silverMoves(board,r,c,owner);
  if(p.type==="KEI") return knightMoves(board,r,c,owner);
  if(p.type==="FU"){
    const d = dirOf(owner), nr=r+d, nc=c;
    const out=[]; if(inBounds(nr,nc) && (!board[nr][nc] || board[nr][nc].owner!==owner)) out.push({r:nr,c:nc});
    return out;
  }
  if(p.type==="KYO")   return rays(board,r,c,[[dirOf(owner),0]],owner);
  if(p.type==="KAKU")  return rays(board,r,c,[[1,1],[1,-1],[-1,1],[-1,-1]],owner);
  if(p.type==="HISHA") return rays(board,r,c,[[1,0],[-1,0],[0,1],[0,-1]],owner);
  if(p.type==="KIN")   return goldMoves(board,r,c,owner);
  return [];
}

export function isSquareAttacked(board, r, c, byOwner){
  for(let rr=0; rr<9; rr++) for(let cc=0; cc<9; cc++){
    const p = board[rr][cc];
    if(!p || p.owner!==byOwner) continue;
    const list = pieceMoves(board, rr, cc);
    if(list.some(t => t.r===r && t.c===c)) return true;
  }
  return false;
}

export function legalMovesFrom(state, r, c, filterSelfCheck=true){
  const p = state.board[r][c];
  if(!p || p.owner!==state.turn) return [];
  const raw = pieceMoves(state.board, r, c).map(to=>({from:{r,c}, to}));

  const canPromote = (mv)=>{
    if(!PROMOTABLE.has(p.type) || p.promoted) return false;
    return promotionZone(p.owner, mv.from.r) || promotionZone(p.owner, mv.to.r);
  };

  let moves = raw.flatMap(mv=>{
    let list = [ {...mv, promote:false } ];
    if(canPromote(mv)){
      const forcePromote =
        (p.type==="FU" || p.type==="KYO") && (mv.to.r === (p.owner===SENTE ? 0 : 8)) ||
        (p.type==="KEI") && (mv.to.r === (p.owner===SENTE ? 0 : 8) || mv.to.r === (p.owner===SENTE ? 1 : 7));
      list = forcePromote ? [ {...mv, promote:true } ] : [ {...mv, promote:true }, {...mv, promote:false } ];
    }
    return list;
  });

  return filterSelfCheck ? moves.filter(mv => !leavesKingInCheck(state, mv)) : moves;
}

export function legalDropsFor(state, owner, type, filterSelfCheck=true){
  const outs=[];
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      if(state.board[r][c]) continue;
      if(type==="FU" || type==="KYO"){
        if(r === (owner===SENTE?0:8)) continue;
      }
      if(type==="KEI"){
        if(owner===SENTE && r<=1) continue;
        if(owner===GOTE  && r>=7) continue;
      }
      if(type==="FU"){
        // 二歩
        let nifu=false;
        for(let rr=0; rr<9; rr++){
          const p = state.board[rr][c];
          if(p && p.owner===owner && p.type==="FU" && !p.promoted){ nifu=true; break; }
        }
        if(nifu) continue;
      }
      const mv = { drop:true, owner, type, to:{r,c} };
      outs.push(mv);
    }
  }
  return filterSelfCheck ? outs.filter(mv => !leavesKingInCheckDrop(state, mv)) : outs;
}

// ==== 自殺手判定（コピー盤で検査） ====
export function leavesKingInCheck(state, mv){
  const next = JSON.parse(JSON.stringify(state));
  const fromP = next.board[mv.from.r][mv.from.c];
  const toP   = next.board[mv.to.r][mv.to.c] || null;

  const couldPromote = !fromP.promoted && PROMOTABLE.has(fromP.type) &&
    (promotionZone(fromP.owner, mv.from.r) || promotionZone(fromP.owner, mv.to.r));
  const forcePromote =
    couldPromote && (
      ((fromP.type==="FU" || fromP.type==="KYO") && (mv.to.r === (fromP.owner===SENTE ? 0 : 8))) ||
      (fromP.type==="KEI" && (mv.to.r === (fromP.owner===SENTE ? 0 : 8) || mv.to.r === (fromP.owner===SENTE ? 1 : 7)))
    );
  const promote = forcePromote ? true : !!mv.promote;

  if(toP && toP.owner!==fromP.owner && toP.type!=="OU"){
    next.hands[fromP.owner][toP.type]++;
  }
  next.board[mv.to.r][mv.to.c] = { type: fromP.type, owner: fromP.owner, promoted: fromP.promoted || promote };
  next.board[mv.from.r][mv.from.c] = null;

  const myKing = findKing(next.board, fromP.owner);
  return isSquareAttacked(next.board, myKing.r, myKing.c, opponent(fromP.owner));
}

export function leavesKingInCheckDrop(state, mv){
  const next = JSON.parse(JSON.stringify(state));
  next.board[mv.to.r][mv.to.c] = { type: mv.type, owner: mv.owner, promoted:false };
  next.hands[mv.owner][mv.type]--;
  const myKing = findKing(next.board, mv.owner);
  return isSquareAttacked(next.board, myKing.r, myKing.c, opponent(mv.owner));
}

// ===== シミュレーション用 apply / undo =====
export function simApplyMove(s, mv){
  if(mv.drop){
    const prev = s.hands[mv.owner][mv.type];
    s.board[mv.to.r][mv.to.c] = { type: mv.type, owner: mv.owner, promoted:false };
    s.hands[mv.owner][mv.type]--;
    const oldTurn = s.turn; s.turn = opponent(s.turn);
    return {kind:"drop", to:mv.to, owner:mv.owner, type:mv.type, prevHand:prev, oldTurn};
  }else{
    const fromP = s.board[ mv.from.r ][ mv.from.c ];
    const toP   = s.board[ mv.to.r   ][ mv.to.c   ] || null;

    const couldPromote = !fromP.promoted && PROMOTABLE.has(fromP.type) &&
      (promotionZone(fromP.owner, mv.from.r) || promotionZone(fromP.owner, mv.to.r));
    const forcePromote =
      couldPromote && (
        ((fromP.type==="FU" || fromP.type==="KYO") && (mv.to.r === (fromP.owner===SENTE ? 0 : 8))) ||
        (fromP.type==="KEI" && (mv.to.r === (fromP.owner===SENTE ? 0 : 8) || mv.to.r === (fromP.owner===SENTE ? 1 : 7)))
      );
    const promote = forcePromote ? true : !!mv.promote;

    if(toP && toP.owner!==fromP.owner && toP.type!=="OU"){
      s.hands[fromP.owner][toP.type]++;
    }

    s.board[mv.to.r][mv.to.c] = { type: fromP.type, owner: fromP.owner, promoted: fromP.promoted || promote };
    s.board[mv.from.r][mv.from.c] = null;

    const oldTurn = s.turn; s.turn = opponent(s.turn);
    return {kind:"move", from:mv.from, to:mv.to, captured:toP, moved:fromP, promotedApplied: promote, oldTurn};
  }
}
export function simUndo(s, undo){
  s.turn = undo.oldTurn;
  if(undo.kind==="drop"){
    s.hands[undo.owner][undo.type] = undo.prevHand;
    s.board[undo.to.r][undo.to.c] = null;
    return;
  }
  if(undo.kind==="move"){
    s.board[undo.from.r][undo.from.c] = { ...undo.moved };
    s.board[undo.to.r][undo.to.c] = undo.captured ? { ...undo.captured } : null;
    if(undo.captured && undo.captured.type!=="OU"){
      s.hands[undo.moved.owner][undo.captured.type]--;
    }
  }
}

export function allLegalMovesForTurn(state){
  const out=[];
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){
    const p = state.board[r][c];
    if(!p || p.owner!==state.turn) continue;
    out.push(...legalMovesFrom(state, r, c, true));
  }
  const hand = state.hands[state.turn];
  for(const t of Object.keys(hand)){
    if(hand[t]>0) out.push(...legalDropsFor(state, state.turn, t, true));
  }
  return out;
}
