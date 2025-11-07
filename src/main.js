// ====== imports ======
import { SENTE, GOTE, opponent, deepCopy, labelForPiece } from "./engine/util.js";
import { initialBoard, findKing, isSquareAttacked,
         legalMovesFrom, legalDropsFor, allLegalMovesForTurn } from "./engine/movegen.js";
import { chooseMoveLevel1, chooseMoveLevel2, chooseMoveLevel3 } from "./engine/search.js";

// ====== globals (必ず import の直後に置く) ======
let state = null;
let history = [];
let vsCPU = true;              // 対人戦は一旦オフ
let humanSide = SENTE;
let cpuSide   = GOTE;
let cpuLevel  = 2;
const CPU_DELAY = 350;

// ====== DOM 参照は boot() で取得するので先に宣言だけ ======
let boardEl, handSenteEl, handGoteEl, turnLabel, undoBtn, resetBtn, promoteDialog, fxLayer;
let titleScreen, titleSide, titleLevel, btnStart;

// ====== state 初期化 ======
function freshState(){
  return {
    board: initialBoard(),
    hands: {
      [SENTE]: { FU:0,KYO:0,KEI:0,GIN:0,KIN:0,KAKU:0,HISHA:0 },
      [GOTE] : { FU:0,KYO:0,KEI:0,GIN:0,KIN:0,KAKU:0,HISHA:0 },
    },
    turn: SENTE,
    lastMove: null,
    selected: null,
  };
}

// ====== ローカル保存の読み込み ======
function loadLocal(){
  try{
    const raw = localStorage.getItem("shogi-simple-komadai");
    if(raw){
      const parsed = JSON.parse(raw);
      state     = parsed.state   || freshState();
      history   = parsed.history || [];
      humanSide = parsed.cpu?.humanSide || SENTE;
      cpuSide   = (humanSide===SENTE)? GOTE : SENTE;
      cpuLevel  = parsed.cpu?.cpuLevel  || 2;
      return;
    }
  }catch(e){}
  state = freshState();
}

// ====== レイアウト（トップバー見切れ防止） ======
function fitBoardToViewport(){
  const style = getComputedStyle(document.documentElement);
  const topbarH  = parseInt(style.getPropertyValue("--topbar-h"))  || 40;
  const handsH   = parseInt(style.getPropertyValue("--hands-h"))   || 58;
  const boardPad = parseInt(style.getPropertyValue("--board-pad")) || 8;
  const gridGap  = parseInt(style.getPropertyValue("--grid-gap"))  || 2;

  const vw = window.innerWidth, vh = window.innerHeight;
  const verticalAvail = Math.max(140, vh - topbarH - (handsH * 2) - 8);
  const overhead = (boardPad * 2) + (gridGap * 8);
  const squareFromH = Math.floor((verticalAvail - overhead) / 9);
  const squareFromW = Math.floor((vw - 16 - overhead) / 9);
  const square = Math.max(16, Math.min(squareFromH, squareFromW)); // 最小16px
  document.documentElement.style.setProperty("--squarepx", square + "px");
}
window.addEventListener("resize", fitBoardToViewport);
window.addEventListener("orientationchange", fitBoardToViewport);

// ====== 画面遷移（タイトルの表示制御は class で） ======
function showTitle(){ document.body.classList.add("show-title"); }
function hideTitle(){ document.body.classList.remove("show-title"); }

// ====== レンダリング ======
function render(){
  boardEl.innerHTML = "";
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const sq = document.createElement("div");
      sq.className = "square";
      sq.dataset.r = r; sq.dataset.c = c;

      const p = state.board[r][c];
      if(p){
        const pieceEl = document.createElement("div");
        pieceEl.className = `piece ${p.owner} ${p.promoted?'promoted':''}`;
        pieceEl.dataset.r = r; pieceEl.dataset.c = c;
        pieceEl.dataset.owner = p.owner; pieceEl.dataset.type = p.type;

        const shape = document.createElement("div");
        shape.className = "shape";
        pieceEl.appendChild(shape);

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = labelForPiece(p);
        pieceEl.appendChild(label);

        pieceEl.addEventListener("click", onPieceClick, {passive:true});
        sq.appendChild(pieceEl);
      }

      sq.addEventListener("click", onSquareClick, {passive:true});
      boardEl.appendChild(sq);
    }
  }

  if(state.lastMove?.to){
    const lm = document.querySelector(`.square[data-r="${state.lastMove.to.r}"][data-c="${state.lastMove.to.c}"]`);
    if(lm) lm.classList.add("lastmove");
  }

  renderHand(handGoteEl,  GOTE);
  renderHand(handSenteEl, SENTE);

  updateCheckEffect();

  turnLabel.textContent = state.turn===SENTE ? "先手の手番" : "後手の手番";

  clearHighlights();
  if(state.selected){
    if(state.selected.from==="board"){
      selectPieceAt(state.selected.r, state.selected.c);
      highlightMoves(legalMovesFrom(state, state.selected.r, state.selected.c, true));
    }else if(state.selected.from==="hand"){
      highlightMoves(legalDropsFor(state, state.turn, state.selected.type, true));
    }
  }
}

function renderHand(el, owner){
  el.innerHTML = "";
  const hand = state.hands[owner];
  const order = ["HISHA","KAKU","KIN","GIN","KEI","KYO","FU"];
  for(const t of order){
    const cnt = hand[t];
    if(cnt>0){
      const cap = document.createElement("div");
      cap.className = "cap"; cap.dataset.owner = owner; cap.dataset.type = t;
      const mini = document.createElement("div"); mini.className = "mini";
      const text = document.createElement("div"); text.textContent =
        t==="HISHA"?"飛":t==="KAKU"?"角":t==="KIN"?"金":t==="GIN"?"銀":t==="KEI"?"桂":t==="KYO"?"香":"歩";
      text.style.position="relative"; text.style.zIndex="1";
      mini.appendChild(text);
      const num  = document.createElement("span"); num.className = "count"; num.textContent = "×"+cnt;
      cap.appendChild(mini); cap.appendChild(num);
      cap.addEventListener("click", onHandClick, {passive:true});
      el.appendChild(cap);
    }
  }
}

function clearHighlights(){
  document.querySelectorAll(".piece").forEach(p=>p.classList.remove("selected"));
  document.querySelectorAll(".square").forEach(s=>s.classList.remove("highlight","incheck"));
}
function selectPieceAt(r,c){
  const pieceEl = document.querySelector(`.piece[data-r="${r}"][data-c="${c}"]`);
  if(pieceEl) pieceEl.classList.add("selected");
}
function highlightMoves(moves){
  for(const m of moves){
    const sq = document.querySelector(`.square[data-r="${m.to.r}"][data-c="${m.to.c}"]`);
    if(sq) sq.classList.add("highlight");
  }
}

// ====== 王手エフェクト（両陣営） ======
function updateCheckEffect(){
  document.querySelectorAll(".square.incheck").forEach(el=>el.classList.remove("incheck"));
  for(const owner of [SENTE, GOTE]){
    const king = findKing(state.board, owner);
    if(!king) continue;
    const inCk = isSquareAttacked(state.board, king.r, king.c, opponent(owner));
    if(inCk){
      const sq = document.querySelector(`.square[data-r="${king.r}"][data-c="${king.c}"]`);
      if(sq) sq.classList.add("incheck");
    }
  }
}

// ====== 入力処理 ======
function blockHumanInput(){ boardEl.style.pointerEvents="none"; handGoteEl.style.pointerEvents="none"; handSenteEl.style.pointerEvents="none"; }
function allowHumanInput(){ boardEl.style.pointerEvents=""; handGoteEl.style.pointerEvents=""; handSenteEl.style.pointerEvents=""; }

function onPieceClick(e){
  if(state.turn===cpuSide) return;
  e.stopPropagation();
  const r = parseInt(e.currentTarget.dataset.r,10);
  const c = parseInt(e.currentTarget.dataset.c,10);
  const p = state.board[r][c];
  if(!p) return;

  if(p.owner !== state.turn){
    if(state.selected && state.selected.from==="board"){
      const ms = legalMovesFrom(state, state.selected.r, state.selected.c, true);
      const target = ms.find(m => m.to.r===r && m.to.c===c);
      if(target) return doMove(target);
    }
    return;
  }
  if(state.selected && state.selected.from==="board" && state.selected.r===r && state.selected.c===c){
    state.selected = null; render();
  }else{
    state.selected = { from:"board", r, c }; render();
  }
}

function onSquareClick(e){
  if(state.turn===cpuSide) return;
  const r = parseInt(e.currentTarget.dataset.r,10);
  const c = parseInt(e.currentTarget.dataset.c,10);

  if(state.selected && state.selected.from==="board"){
    const ms = legalMovesFrom(state, state.selected.r, state.selected.c, true);
    const mv = ms.find(m => m.to.r===r && m.to.c===c);
    if(mv) return doMove(mv);
  }
  if(state.selected && state.selected.from==="hand"){
    const ds = legalDropsFor(state, state.turn, state.selected.type, true);
    const drop = ds.find(d => d.to.r===r && d.to.c===c);
    if(drop) return doDrop(drop);
  }
}

function onHandClick(e){
  if(state.turn===cpuSide) return;
  const owner = e.currentTarget.dataset.owner;
  const type = e.currentTarget.dataset.type;
  if(owner !== state.turn) return;
  if(state.selected && state.selected.from==="hand" && state.selected.type===type){
    state.selected = null; render(); return;
  }
  state.selected = { from:"hand", type }; render();
}

// ====== 終局チェック ======
function allLegalMovesForCurrent(){ return allLegalMovesForTurn(state); }
function checkEndIfNoLegalMoves(){
  const legal = allLegalMovesForCurrent();
  if(legal.length===0){
    const king = findKing(state.board, state.turn);
    if(king && isSquareAttacked(state.board, king.r, king.c, opponent(state.turn))){
      showMateFlash();
    }
  }
}

// ====== 成り確認 ======
function openPromoteDialog(){
  return new Promise(resolve=>{
    promoteDialog.returnValue = "";
    const onClose = ()=>{ promoteDialog.removeEventListener("close", onClose); resolve(promoteDialog.returnValue); };
    promoteDialog.addEventListener("close", onClose);
    promoteDialog.showModal();
    const yes = promoteDialog.querySelector('.promote-yes');
    if(yes) yes.focus({preventScroll:true});
  });
}

// ====== 着手処理 ======
async function doMove(mv){
  pushHistory();
  const fromP = state.board[mv.from.r][mv.from.c];
  const toP   = state.board[mv.to.r][mv.to.c];

  const inZoneFrom = (fromP.owner===SENTE ? (mv.from.r<=2) : (mv.from.r>=6));
  const inZoneTo   = (fromP.owner===SENTE ? (mv.to.r  <=2) : (mv.to.r  >=6));
  const couldPromote = !fromP.promoted && ["FU","KYO","KEI","GIN","KAKU","HISHA"].includes(fromP.type) && (inZoneFrom || inZoneTo);
  const forcePromote =
    couldPromote && (
      ((fromP.type==="FU" || fromP.type==="KYO") && (mv.to.r === (fromP.owner===SENTE ? 0 : 8))) ||
      (fromP.type==="KEI" && (mv.to.r === (fromP.owner===SENTE ? 0 : 8) || mv.to.r === (fromP.owner===SENTE ? 1 : 7)))
    );

  let promote = !!mv.promote;
  if(forcePromote){ promote = true; }
  else if(couldPromote){
    const choice = await openPromoteDialog();
    promote = (choice==="promote");
  }

  if(toP && toP.owner!==fromP.owner && toP.type!=="OU"){
    state.hands[fromP.owner][toP.type]++;
  }
  state.board[mv.to.r][mv.to.c]     = { type: fromP.type, owner: fromP.owner, promoted: fromP.promoted || promote };
  state.board[mv.from.r][mv.from.c] = null;

  state.lastMove = { from:mv.from, to:mv.to, promoted: promote||false };
  state.selected = null;
  state.turn = opponent(state.turn);

  saveLocal(); render(); checkEndIfNoLegalMoves();
  queueCpuIfNeeded();
}

function doDrop(mv){
  pushHistory();
  state.board[mv.to.r][mv.to.c] = { type: mv.type, owner: mv.owner, promoted:false };
  state.hands[mv.owner][mv.type]--;
  state.lastMove = { from:null, to:mv.to, dropType:mv.type };
  state.selected = null;
  state.turn = opponent(state.turn);
  saveLocal(); render(); checkEndIfNoLegalMoves();
  queueCpuIfNeeded();
}

// ====== エフェクト ======
function showMateFlash(){
  Array.from(fxLayer.querySelectorAll(".mate-flash")).forEach(n=>n.remove());
  const el = document.createElement("div");
  el.className = "mate-flash";
  el.textContent = "詰み";
  fxLayer.appendChild(el);
  setTimeout(()=>{ el.remove(); }, 2500);
}

// ====== CPU ======
function chooseCpuMove(){
  const snapshot = deepCopy(state);
  const aiSide = cpuSide;
  if(cpuLevel===1) return chooseMoveLevel1(snapshot, aiSide);
  if(cpuLevel===2) return chooseMoveLevel2(snapshot, aiSide);
  return chooseMoveLevel3(snapshot, aiSide);
}

let cpuTimer = null;
function queueCpuIfNeeded(){
  if(cpuTimer){ clearTimeout(cpuTimer); cpuTimer=null; }
  if(!vsCPU) { allowHumanInput(); return; }
  if(state.turn !== cpuSide){ allowHumanInput(); return; }

  blockHumanInput();
  cpuTimer = setTimeout(()=>{
    const mv = chooseCpuMove();
    if(!mv){
      const king = findKing(state.board, cpuSide);
      const inCheck = king && isSquareAttacked(state.board, king.r, king.c, humanSide);
      if(inCheck) showMateFlash();
      allowHumanInput();
      return;
    }
    if(mv.drop) doDrop(mv); else doMove(mv);
  }, CPU_DELAY);
}

// ====== Undo / Reset / 保存 ======
function pushHistory(){ history.push(JSON.stringify(state)); if(history.length>200) history.shift(); }
function undo(){
  if(state.turn===cpuSide) return;
  if(history.length===0) return;
  const prev = history.pop();
  state = JSON.parse(prev);
  saveLocal(); render();
}
function reset(){
  history = [];
  state = freshState();
  saveLocal(); render();
  queueCpuIfNeeded();
}
function saveLocal(){
  try{
    localStorage.setItem("shogi-simple-komadai",
      JSON.stringify({state, history, cpu:{vsCPU, humanSide, cpuSide, cpuLevel}})
    );
  }catch(e){}
}

// ====== タイトル開始 ======
function onStartClick(){
  humanSide = (titleSide.value === "sente") ? SENTE : GOTE;
  cpuSide   = opponent(humanSide);
  cpuLevel  = parseInt(titleLevel.value,10) || 2;

  history = [];
  state = freshState();
  state.turn = SENTE;         // 先手番から
  saveLocal();
  hideTitle();
  fitBoardToViewport();
  render();
  if(cpuSide===SENTE) queueCpuIfNeeded();
}

// ====== 起動（DOM完成後に一度だけ） ======
function boot(){
  // DOM 取得
  boardEl      = document.getElementById("board");
  handSenteEl  = document.getElementById("handSente");
  handGoteEl   = document.getElementById("handGote");
  turnLabel    = document.getElementById("turnLabel");
  undoBtn      = document.getElementById("undoBtn");
  resetBtn     = document.getElementById("resetBtn");
  promoteDialog= document.getElementById("promoteDialog");
  fxLayer      = document.getElementById("fxLayer");

  titleScreen  = document.getElementById("titleScreen");
  titleSide    = document.getElementById("titleSide");
  titleLevel   = document.getElementById("titleLevel");
  btnStart     = document.getElementById("btnStart");

  if(!btnStart || !titleScreen || !boardEl){
    console.error("[boot] 必須DOMが見つかりません", {btnStart, titleScreen, boardEl});
    return;
  }

  // イベント配線
  btnStart.addEventListener("click", onStartClick);
  // クリック委譲（保険）
  titleScreen.addEventListener("click", (e)=>{
    const btn = e.target.closest("#btnStart");
    if(btn) onStartClick();
  });
  // Enter キー開始
  titleScreen.addEventListener("keydown", (e)=>{
    if(e.key === "Enter") onStartClick();
  });
  titleScreen.tabIndex = 0;

  undoBtn?.addEventListener("click", ()=> undo());
  resetBtn?.addEventListener("click", ()=>{
    if(confirm("初期化しますか？")){ reset(); showTitle(); }
  });

  // 起動
  loadLocal();
  fitBoardToViewport();
  render();
  showTitle();

  // デバッグログ（必要なければ消してOK）
  // console.log("[wire] btnStart:", !!btnStart, "side=", titleSide?.value, "lv=", titleLevel?.value);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
