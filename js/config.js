// Google Drive keeps the photos and the exhibition file. Both values below are meant to be public:
// every site with Google sign-in has them in its pages, and the key only works from this site.
export const GOOGLE = {
  clientId: '74371386532-h8kkp93sggtnoh0vvk9enajdboookcge.apps.googleusercontent.com',
  apiKey: 'AIzaSyCgJRZhHLapzV4BN-BvWljhYPdWb7WU3Cg',
  // the exhibition file in Drive; set once the owner has signed in the first time
  manifestId: '10TAbpOPwnV1aBR5Z_H2QmlGwwBalKiL9',
  // the visitor log's web app (apps-script/visits.gs); empty means visits aren't counted
  visitsUrl: 'https://script.google.com/macros/s/AKfycbx6KPOeE28gPvZbsC8WlgcOhVicRrrWph6H_8M-gJtEjfMERODRSe2NDWWAI_ucLuD4/exec',
};
