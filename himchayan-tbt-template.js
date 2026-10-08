/* HimChayan TBT / Digital OMR Template Engine contract.
   Based on the supplied mock2.html TBT structure. */
window.HimChayanTBT={
  name:'TBT (OMR)',
  version:'1.0',
  settings:{timer:120,language:'Both',negativeMark:0.25,shuffle:true},
  start(config){return {...this.settings,...config}},
  features:['question-paper-pane','digital-omr','sections','language','timer','mark-review','resizable-split','result','answer-key'],
  states:['not-answered','answered','marked-review','answered-review']
};
