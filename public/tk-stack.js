function onscrollUpdateStacks(stackElems, lines) {
  var i;
  var stackBox = stackElems[0][0].getBoundingClientRect();
  var stackMid = (stackBox.top + 3*stackBox.bottom) / 4.0;

  var current = -1;
  var currentY = -Infinity;
  // Find the thing to highlight.
  for (i = 0; i < stackElems.length; ++i) {
    var divBox = stackElems[i][1].getBoundingClientRect();
    // We want to highlight it if the div is sufficiently far down compared
    // to the floating stack image.
    if (divBox.top < stackMid) {
      // And among those, we want the top one.
      if (currentY < divBox.top) {
        current = i;
        currentY = divBox.top;
      }
    }
  }

  for (i = 0; i < stackElems.length; ++i) {
    var stackId = stackElems[i][0].getAttribute("data-stack-id");

    // Update the elements that don't have the correct state already.
    var shouldBeOpaque = (current == -1) || (current == i);
    if (stackElems[i][2] == shouldBeOpaque) continue;

    stackElems[i][2] = shouldBeOpaque;

    if (shouldBeOpaque) {
      stackElems[i][0].classList.add("tk-stack-active");

      if (stackId == "tracing") {
        lines.classList.add("tk-stack-active");
      }
    } else {
      stackElems[i][0].classList.remove("tk-stack-active");
    }
  }

  // Handle the lines
  var isTracing = current >= 0 && stackElems[current][0].getAttribute("data-stack-id") == "tracing";

  if (isTracing) {
    lines.classList.add("tk-stack-active");
  } else {
    lines.classList.remove("tk-stack-active");
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var stack = document.getElementsByClassName("tk-stack-active");
  var lines = document.getElementById("tk-stack-lines");

  var stackElems = [];
  for (var i = 0; i < stack.length; ++i) {
    var stackId = stack[i].dataset.stackId;
    var div = document.getElementById("tk-lib-stack-" + stackId);
    // The boolean stores whether it is currently opaque.
    stackElems.push([stack[i], div, true]);
  }

  if (stackElems.length > 0) {
    var fn = function() {
      onscrollUpdateStacks(stackElems, lines);
    };
    window.addEventListener("scroll", fn);
    window.addEventListener("resize", fn);
    setTimeout(fn);
  }
});
