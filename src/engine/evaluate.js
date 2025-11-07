import { VALUE, PROMO_BONUS, opponent } from "./util.js";
import { allLegalMovesForTurn, findKing, isSquareAttacked } from "./movegen.js";

// 基本：材料 + モビリティ + 王手/被王手補正 + 盤の前進ボーナス（歩・軽駒）
export function materialScore(state, side){
  let score = 0;
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){
    const p = state.board[r][c]; if(!p) continue;
    const sign = (p.owner===side)? +1 : -1;
    const base = VALUE[p.type] || 0;
    const promo = p.promoted ? (PROMO_BONUS[p.type]||0) : 0;
    score += sign * (base + promo);

    // 位置ボーナス（軽い）：前進していれば+0.05/段（歩・桂・銀）
    if(["FU","KEI","GIN"].includes(p.type) && !p.promoted){
      const rank = (p.owner===side) ? (8 - r) : r;
      score += sign * (rank * 0.05);
    }
  }
  // 持ち駒
  for(const owner of [side, opponent(side)]){
    const sign = (owner===side)? +1 : -1;
    for(const t of Object.keys(state.hands[owner])){
      const cnt = state.hands[owner][t];
      score += sign * cnt * (VALUE[t]||0);
    }
  }
  return score;
}

export function evaluate(state, side){
  const savedTurn = state.turn;

  // 材料
  let s = materialScore(state, side);

  // モビリティ（自分手番/相手手番にセットしてカウント）
  state.turn = side;
  const myMoves = allLegalMovesForTurn(state).length;
  state.turn = opponent(side);
  const opMoves = allLegalMovesForTurn(state).length;

  s += 0.05 * (myMoves - opMoves);

  // 王手状況（自/相）
  const myKing  = findKing(state.board, side);
  const opKing  = findKing(state.board, opponent(side));
  const myIn    = isSquareAttacked(state.board, myKing.r, myKing.c, opponent(side));
  const opIn    = isSquareAttacked(state.board, opKing.r, opKing.c, side);
  if(myIn) s -= 1.2;     // 被王手はマイナス
  if(opIn) s += 1.0;     // 王手はプラス

  state.turn = savedTurn;
  return s;
}
