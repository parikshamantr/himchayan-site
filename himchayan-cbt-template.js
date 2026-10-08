/* HimChayan CBT Template Engine contract.
   UI/logic is based on the supplied CBT-style mock workflow.
   Backend adapter will inject published questions and settings. */
window.HimChayanCBT={
  name:'CBT',
  version:'1.0',
  settings:{timer:120,language:'Both',negativeMark:0.25,shuffle:true},
  start(config){return {...this.settings,...config}},
  states:['not-visited','visited-unanswered','answered','review','review-answered'],
  features:['timer','sections','language','question-palette','mark-review','result','answer-key']
};
