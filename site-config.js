const isGithubPages = /github\.io$/i.test(window.location.hostname);

window.CRONAN_LOCKE_CONFIG = {
  apiUrl: isGithubPages
    ? "https://script.google.com/macros/s/AKfycbwdHTZgApmf1-thCTbTLFCQLxNK9yP-yKkAMS5lBbmmlO-SuHJRnvxLFcC2PRa23oV_IQ/exec"
    : `${window.location.origin}/api/v1/portal`,
  siteMode: isGithubPages ? "live" : "vps"
};
