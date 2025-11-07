import { deepCopy, opponent } from "./util.js";
import { evaluate } from "./evaluate.js";
import { allLegalMovesForTurn, simApplyMove, simUndo } from "./movegen.js";

// Lv1: ランダム
export function chooseMoveLevel1(state, aiSide){
  const s = deepCopy(state); s.turn = aiSide;
  const mv = allLegalMovesForTurn(s);
  if(mv.length===0) return null;
  return mv[Math.floor(Math.random()*mv.length)];
}

// Lv2: 1手先読み
export function chooseMoveLevel2(state, aiSide){
  const s = deepCopy(state); s.turn = aiSide;
  const moves = allLegalMovesForTurn(s);
  if(moves.length===0) return null;
  let best=null, bestScore=-Infinity;
  for(const m of moves){
    const u = simApplyMove(s, m);
    const sc = evaluate(s, aiSide);
    simUndo(s, u);
    if(sc>bestScore){ bestScore=sc; best=m; }
  }
  return best;
}

// Lv3: αβ探索 + 簡易静止探索（取り合い延長）
function quiescence(s, alpha, beta, side){
  // 取り合いの静止探索（1手深さ、キャプチャーだけ延長）
  // 実装簡易：合法手から「相手駒を取れる手」だけ展開
  const moves = allLegalMovesForTurn(s).filter(m=>{
    if(m.drop) return false;
    const cap = s.board[m.to.r][m.to.c];
    return !!cap;
  });
  const standPat = evaluate(s, side);
  if(standPat >= beta) return beta;
  if(alpha < standPat) alpha = standPat;
  for(const m of moves){
    const u = simApplyMove(s, m);
    const score = -quiescence(s, -beta, -alpha, opponent(side));
    simUndo(s, u);
    if(score >= beta) return beta;
    if(score > alpha) alpha = score;
  }
  return alpha;
}

export function chooseMoveLevel3(state, aiSide){
  const s = deepCopy(state);
  const MAX_DEPTH = 2;

  function alphabeta(sideToMove, depth, alpha, beta){
    if(depth===0){
      return quiescence(s, alpha, beta, aiSide);
    }
    s.turn = sideToMove;
    const moves = allLegalMovesForTurn(s);
    if(moves.length===0){
      // 合法手なし：王手の有無で評価を極端化
      const stand = evaluate(s, aiSide);
      return stand - (sideToMove===aiSide ? 2000 : -2000);
    }
    if(sideToMove===aiSide){
      let v=-Infinity;
      for(const m of moves){
        const u = simApplyMove(s, m);
        const sc = alphabeta(opponent(sideToMove), depth-1, alpha, beta);
        simUndo(s, u);
        if(sc>v) v=sc;
        if(v>alpha) alpha=v;
        if(alpha>=beta) break;
      }
      return v;
    }else{
      let v=+Infinity;
      for(const m of moves){
        const u = simApplyMove(s, m);
        const sc = alphabeta(opponent(sideToMove), depth-1, alpha, beta);
        simUndo(s, u);
        if(sc<v) v=sc;
        if(v<beta) beta=v;
        if(alpha>=beta) break;
      }
      return v;
    }
  }

  s.turn = aiSide;
  const root = allLegalMovesForTurn(s);
  if(root.length===0) return null;

  let best=null, bestScore=-Infinity;
  for(const m of root){
    const u = simApplyMove(s, m);
    const sc = alphabeta(opponent(aiSide), MAX_DEPTH-1, -Infinity, +Infinity);
    simUndo(s, u);
    if(sc>bestScore){ bestScore=sc; best=m; }
  }
  return best;
}
