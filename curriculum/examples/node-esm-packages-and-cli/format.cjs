module.exports = Object.freeze({
  defaultLabel: 'summary',
  formatSummary(value) {
    return JSON.stringify({label: value.label, count: value.count, total: value.total}) + '\n';
  }
});
