let counter = 0;

document.getElementById('increase').addEventListener('click', () => {
  counter++;
  document.getElementById('counter').textContent = counter;
});

document.getElementById('decrease').addEventListener('click', () => {
  counter--;
  document.getElementById('counter').textContent = counter;
});

document.getElementById('reset').addEventListener('click', () => {
  counter = 0;
  document.getElementById('counter').textContent = counter;
});
