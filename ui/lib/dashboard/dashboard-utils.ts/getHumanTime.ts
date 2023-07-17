export const getHumanTime = function (timestamp:number) {
  // Convert to a positive integer
  let time = Math.abs(timestamp);
  // Define humanTime and units
  let humanTime;
  let units;

  if (time > 1000 * 60 * 60 * 24 * 365) {
    humanTime = parseInt(time / (1000 * 60 * 60 * 24 * 365), 10);
    units = "years";
  } else if (time > 1000 * 60 * 60 * 24 * 30) {
    humanTime = parseInt(time / (1000 * 60 * 60 * 24 * 30), 10);
    units = "months";
  } else if (time > 1000 * 60 * 60 * 24 * 7) {
    humanTime = parseInt(time / (1000 * 60 * 60 * 24 * 7), 10);
    units = "weeks";
  } else if (time > 1000 * 60 * 60 * 24) {
    humanTime = parseInt(time / (1000 * 60 * 60 * 24), 10);
    units = "days";
  } else if (time > 1000 * 60 * 60) {
    humanTime = parseInt(time / (1000 * 60 * 60), 10);
    units = "hours";
  } else if (time > 1000 * 60) {
    humanTime = parseInt(time / (1000 * 60), 10);
    units = "minutes";
  } else {
    humanTime = parseInt(time / 1000, 10);
    units = "seconds";
  }

  return `${humanTime} ${humanTime == "1" ? units.slice(0,units.length-1) : units}`;
};
