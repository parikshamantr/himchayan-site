/* Central no-code content model for HimChayan Learning Engine.
   This file intentionally contains no credentials or storage implementation. */
window.HimChayanLearning={
  version:'1.0',
  mockCategories:['Subject Mock','Competitive Exam Mock'],
  competitiveExams:['JBT','TGT','JOA','Panchayat Secretary','Secretariat Clerk','HP Police','Forest','Patwari','High Court','Staff Nurse','HP TET','CTET','HAS','SSC','SSC GD','CGL','PGT','Railway','Banking','Allied','Naib Tehsildar','Other Exam'],

  /* Central competitive-exam subject model.
     Existing exam names are preserved; this only adds subject metadata
     so CBT/TBT selectors can use the same source without renaming data files. */
  competitiveSubjects:{
    'JBT':['General Knowledge','Himachal Pradesh GK','Hindi','English','Child Development & Pedagogy','Reasoning','Mathematics'],
    'TGT':['General Knowledge','Himachal Pradesh GK','Hindi','English','Reasoning','Mathematics','Concerned Subject'],
    'JOA':['General Knowledge','Himachal Pradesh GK','English','Hindi','Computer','Reasoning','Mathematics'],
    'Panchayat Secretary':['General Knowledge','Himachal Pradesh GK','Panchayati Raj','Hindi','English','Reasoning','Mathematics'],
    'Secretariat Clerk':['General Knowledge','Himachal Pradesh GK','Hindi','English','Reasoning','Mathematics','Computer'],
    'HP Police':['General Knowledge','Himachal Pradesh GK','Current Affairs','Hindi','English','Reasoning','Mathematics'],
    'Forest':['General Knowledge','Himachal Pradesh GK','Environment & Ecology','Science','Mathematics','Reasoning','Current Affairs'],
    'Patwari':['General Knowledge','Himachal Pradesh GK','Current Affairs','Hindi','English','Mathematics','Reasoning'],
    'High Court':['General Knowledge','Himachal Pradesh GK','English','Hindi','Reasoning','Computer','General Law Awareness'],
    'Staff Nurse':['General Knowledge','Himachal Pradesh GK','Nursing','General Science','Reasoning','English','Current Affairs'],
    'HP TET':['Child Development & Pedagogy','English','Hindi','General Awareness','Concerned Subject'],
    'CTET':['Child Development & Pedagogy','Language I','Language II','Mathematics','Environmental Studies','Concerned Subject'],
    'HAS':['General Studies','Himachal Pradesh GK','Current Affairs','Aptitude','English','General Hindi','Optional Subject'],
    'SSC':['General Intelligence & Reasoning','Quantitative Aptitude','English','General Awareness'],
    'SSC GD':['General Intelligence & Reasoning','General Knowledge & Awareness','Elementary Mathematics','English/Hindi'],
    'CGL':['General Intelligence & Reasoning','General Awareness','Quantitative Aptitude','English Comprehension'],
    'PGT':['Hindi','English','History','Political Science','Geography','Economics'],
    'Railway':['General Awareness','General Intelligence & Reasoning','Mathematics','General Science'],
    'Banking':['Reasoning Ability','Quantitative Aptitude','English Language','General Awareness','Computer Awareness'],
    'Allied':['General Knowledge','Himachal Pradesh GK','Current Affairs','English','Hindi','Reasoning','Mathematics'],
    'Naib Tehsildar':['General Knowledge','Himachal Pradesh GK','Current Affairs','Hindi','English','Reasoning','Mathematics'],
    'Other Exam':['General Knowledge','Current Affairs','Hindi','English','Reasoning','Mathematics']
  },

  pgtSubjects:['Hindi','English','History','Political Science','Geography','Economics'],
  access:['FREE','PAID','ADMIN_ONLY','HIDDEN'],
  templates:['CBT','TBT'],
  resourceControls:['exam_group','exam_name','content_type','subject','title','description','file_type','access_type','price','display_order','external_url','upload','allow_view','allow_download','is_published','is_active'],
  mockControls:['mock_name','category','exam','subject','template','total_questions','timer_minutes','negative_marking','language','access','price','attempt_limit','shuffle','result','answer_key','review','published','active'],

  getSubjects(exam){
    const key=String(exam||'').trim();
    return this.competitiveSubjects[key] || ['General Knowledge','Current Affairs','Hindi','English','Reasoning','Mathematics'];
  },

  getExams(){ return this.competitiveExams.slice(); }
};

/* Global bridge used by homepage / CBT / TBT selectors. */
window.HimChayanLearningEngine = window.HimChayanLearningEngine || window.HimChayanLearning;
