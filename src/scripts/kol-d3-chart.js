// URLs to external CSV files
const rateDataUrl = "https://kol-exchange-web.s3.us-east-1.amazonaws.com/mr_accessory_rate_history.csv";
const itemDataUrl = "https://kol-exchange-web.s3.us-east-1.amazonaws.com/iotm_history.csv";

// Global variables to store data and chart elements
let rateData, itemData, svg, x, y, line, dots, itemRegions;
let width, height, margin;

// Function to create the chart
function createChart(rateData, itemData) {
    document.getElementById("chart").innerHTML = "";

    // Set up dimensions and margins based on the container size
    const chartContainer = document.getElementById("chart").parentElement;
    let width = (chartContainer.clientWidth || 600) * 0.85;
    height = width;
    margin = {
        top: 10,
        right: 10,
        bottom: 60,
        left: 60
    };

    // Create SVG
    svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    x = d3.scaleTime()
        .domain(d3.extent(rateData, d => d.date))
        .range([0, width]);

    y = d3.scaleLinear()
        .domain([
            d3.min(rateData, d => d.rate) * 0.99,
            d3.max(rateData, d => d.rate) * 1.01
        ])
        .range([height, 0]);

    // Add a group for item regions (added before axes so they appear behind)
    svg.append("g")
        .attr("class", "item-regions-group");

    // Add X grid lines
    svg.append("g")
        .attr("class", "grid x-grid")
        .attr("transform", `translate(0,${height})`);

    // Add Y grid lines
    svg.append("g")
        .attr("class", "grid y-grid");

    // Add X axis
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`);

    // Add Y axis
    svg.append("g")
        .attr("class", "y-axis");

    // Add Y axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left)
        .attr("x", -height / 2)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Exchange Rate (Meat / USD)");

    // Create the line
    line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.rate));

    // Add the line path
    svg.append("path")
        .attr("class", "line")
        .datum(rateData);

    // Add tooltip div
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip");

    // Create group for dots
    svg.append("g")
        .attr("class", "dots-group");

    // Create group for item labels
    svg.append("g")
        .attr("class", "item-labels-group");

    // Create a rect for capturing mouse movement
    const mouseArea = svg.append("rect")
        .attr("class", "overlay")
        .attr("width", width)
        .attr("height", height)
        .on("mousemove", mousemove)
        .on("mouseout", mouseout);

    function mousemove(event) {
        const [mouseX] = d3.pointer(event);
        const x0 = x.invert(mouseX);

        // Filter visible data based on current domain
        const visibleData = rateData.filter(d => {
            return d.date >= x.domain()[0] && d.date <= x.domain()[1];
        });

        if (visibleData.length === 0) return;

        // Find the closest data point to the mouse position
        const bisect = d3.bisector(d => d.date).left;
        const i = bisect(visibleData, x0, 1);

        // Check if we're at the edge of the data
        if (i === 0 || i >= visibleData.length) {
            return;
        }

        const d0 = visibleData[i - 1];
        const d1 = visibleData[i];
        const d = x0 - d0.date > d1.date - x0 ? d1 : d0;

        // Update dot visibility
        svg.selectAll(".dot")
            .style("opacity", dot => (dot.date.getTime() === d.date.getTime()) ? 1 : 0);

        // Find the current item period
        const currentItem = findItemForDate(d.date);
        const itemInfo = currentItem ?
            `<br><strong>Item:</strong> ${currentItem.item_name}` +
            `<br><strong>Type:</strong> ${currentItem.is_familiar === 1 ? 'FOTM' : 'IOTM'}` : '';

        // Position and show tooltip
        tooltip
            .style("opacity", 0.9)
            .html(`<strong>Date:</strong> ${d3.utcFormat("%e %B %Y")(d.date)}<br>
                <strong>Rate:</strong> ${d.rate.toLocaleString()}  Meat
                ${itemInfo}`)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 30}px`);
    }

    function mouseout() {
        svg.selectAll(".dot").style("opacity", 0);
        tooltip.style("opacity", 0);
    }

    // Function to find which item period a date falls into
    function findItemForDate(date) {
        for (let i = 0; i < itemData.length; i++) {
            const currentItemDate = itemData[i].date;
            const nextItemDate = i < itemData.length - 1 ? itemData[i + 1].date : new Date(8640000000000000); // Far future date

            if (date >= currentItemDate && date < nextItemDate) {
                return itemData[i];
            }
        }
        return null;
    }

    // Initialize with "3 Month" view by default
    updateChart("3");

    // Set up zoom buttons
    d3.selectAll(".zoom-btn").on("click", function () {
        d3.selectAll(".zoom-btn").classed("active", false);
        d3.select(this).classed("active", true);

        const months = d3.select(this).attr("data-months");
        updateChart(months);
    });
}

// Function to update the chart based on zoom level
function updateChart(monthsStr) {
    // Calculate new domain based on selected time period
    let startDate, endDate;

    if (monthsStr === "all") {
        // Show all data
        startDate = d3.min(rateData, d => d.date);
        endDate = d3.max(rateData, d => d.date);
    } else {
        // Show specified months of data
        const months = parseInt(monthsStr);
        endDate = d3.max(rateData, d => d.date);
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - months);
        startDate.setDate(1);
    }

    // Reset time components to midnight UTC to match parsed CSV dates
    startDate = new Date(Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0, 0, 0, 0
    ));

    // Update x scale domain
    x.domain([startDate, endDate]);

    // Filter visible data
    const visibleRateData = rateData.filter(d => {
        return d.date >= startDate && d.date <= endDate;
    });

    // Update y scale domain based on visible data
    if (visibleRateData.length > 0) {
        y.domain([
            d3.min(visibleRateData, d => d.rate) * 0.99,
            d3.max(visibleRateData, d => d.rate) * 1.05
        ]);
    }

    // Update X grid lines
    svg.select(".x-grid")
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickSize(-height)
            .tickFormat("")
        );

    // Update Y grid lines
    svg.select(".y-grid")
        .call(d3.axisLeft(y)
            .ticks(10)
            .tickSize(-width)
            .tickFormat("")
        );

    // Update X axis
    svg.select(".x-axis")
        .call(d3.axisBottom(x).tickFormat(d3.utcFormat("%e %b %Y")))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    // Update Y axis with custom formatting for large numbers
    svg.select(".y-axis")
        .call(d3.axisLeft(y).tickFormat(d => {
            // Format large numbers with abbreviations
            if (d >= 1000000) {
                return (d / 1000000).toFixed(1) + "M";
            } else if (d >= 1000) {
                return (d / 1000).toFixed(1) + "K";
            } else {
                return d.toFixed(0);
            }
        }));

    // Update line
    svg.select(".line")
        .datum(visibleRateData)
        .attr("d", line);

    // Update or create dots
    const dotsGroup = svg.select(".dots-group");
    dotsGroup.selectAll(".dot").remove();

    dots = dotsGroup.selectAll(".dot")
        .data(visibleRateData)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("r", 5)
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.rate))
        .style("opacity", 0);

    // Update or create item regions
    updateItemRegions(startDate, endDate);

    // Color the chart elements based on dark mode
    if (isDarkMode) {
        d3.selectAll(".zoom-btn").classed("dark", true);
        d3.selectAll(".axis-label").classed("dark", true);
    } else {
        d3.selectAll(".zoom-btn").classed("dark", false);
        d3.selectAll(".axis-label").classed("dark", false);
    }
}

// Function to update item regions and labels
function updateItemRegions(startDate, endDate) {
    const regionsGroup = svg.select(".item-regions-group");
    const labelsGroup = svg.select(".item-labels-group");

    // Remove existing regions and labels
    regionsGroup.selectAll(".item-region").remove();
    labelsGroup.selectAll(".item-label").remove();

    // Filter items visible in the current view
    const visibleItems = [];

    // Create item periods (from one item introduction to the next)
    for (let i = 0; i < itemData.length; i++) {
        const currentItem = itemData[i];
        const nextItem = i < itemData.length - 1 ? itemData[i + 1] : null;

        let regionStart = currentItem.date;
        let regionEnd = nextItem ? nextItem.date : new Date(8640000000000000); // Far future date

        // Skip if region is completely outside current view
        if (regionEnd < startDate || regionStart > endDate) continue;

        // Clip region to current view
        regionStart = regionStart < startDate ? startDate : regionStart;
        regionEnd = regionEnd > endDate ? endDate : regionEnd;

        // Alternate coloring - add index info
        visibleItems.push({
            item: currentItem,
            start: regionStart,
            end: regionEnd,
            index: i  // Used for alternating colors
        });
    }

    // Add regions with alternating colors
    regionsGroup.selectAll(".item-region")
        .data(visibleItems)
        .enter()
        .append("rect")
        .attr("class", d => {
            // Alternating color scheme based on index
            const colorClass = d.index % 2 === 0 ? 'color-a' : 'color-b';
            // Add familiar class if applicable
            return `item-region ${colorClass} ${d.item.is_familiar === 1 ? 'familiar' : ''}`;
        })
        .attr("x", d => x(d.start))
        .attr("y", 0)
        .attr("width", d => Math.max(1, x(d.end) - x(d.start))) // Ensure minimum width of 1px
        .attr("height", height);

    // Add multi-line labels
    labelsGroup.selectAll(".item-label")
        .data(visibleItems)
        .enter()
        .append("text")
        .attr("class", "item-label")
        .attr("x", d => x(d.start) + (x(d.end) - x(d.start)) / 2)
        .attr("y", 2)
        .attr("text-anchor", "middle")
        .style("display", function (d) {
            // Hide labels that are too narrow
            const width = x(d.end) - x(d.start);
            return width < 26 ? "none" : null;
        })
        .each(function (d) {
            const text = d3.select(this);
            const name = d.item.item_name;
            const regionWidth = x(d.end) - x(d.start);

            // Calculate how many characters we can fit per line
            // Rough estimate: 5 pixels per character
            const charsPerLine = Math.floor(regionWidth / 5);

            if (name.length <= charsPerLine) {
                // If name fits, show in one line
                text.append("tspan")
                    .attr("x", d3.select(this).attr("x"))
                    .attr("dy", "0.9em")
                    .text(name);
            } else {
                // Split into multiple lines
                const words = name.split(' ');
                let line = '';
                let lineNumber = 0;

                for (let i = 0; i < words.length; i++) {
                    // If the word itself is too long, truncate it
                    if (words[i].length > charsPerLine) {
                        words[i] = words[i].substring(0, charsPerLine - 3) + '... ';
                    }

                    let testLine = line + words[i] + ' ';

                    // If adding another word exceeds the line length
                    if (testLine.length > charsPerLine) {
                        // If this is not the first word of the line, add the current line
                        if (line !== '') {
                            text.append("tspan")
                                .attr("x", d3.select(this).attr("x"))
                                .attr("dy", lineNumber === 0 ? "0.9em" : "1.1em")
                                .text(line.trim());

                            lineNumber++;
                        }

                        // Move to the next line
                        line = words[i] + ' ';
                    } else {
                        line = testLine;
                    }
                }

                // Append the last line if any remaining
                if (line !== '') {
                    text.append("tspan")
                        .attr("x", d3.select(this).attr("x"))
                        .attr("dy", lineNumber === 0 ? "0.9em" : "1.1em")
                        .text(line.trim());
                }
            }
        });
}

// Function to load both datasets
function loadChartData() {
    Promise.all([
        d3.csv(rateDataUrl),
        d3.csv(itemDataUrl)
    ]).then(function (results) {
        // Define a UTC date parser
        const parseDate = d3.utcParse("%Y-%m-%d");

        // Parse the rate data
        rateData = results[0].map(d => {
            return {
                date: parseDate(d.date.substring(0, 10)),
                rate: +d.rate,
                item_name: d.iotm_name,
                is_familiar: +d.iotm_is_familiar // Convert to number (1 = familiar, other = regular)
            };
        }).sort((a, b) => a.date - b.date); // Ensure dates are sorted

        // Parse the item data
        itemData = results[1].map(d => {
            return {
                date: parseDate(d.date.substring(0, 10)),
                item: d.item,
                item_name: d.iotm_name,
                is_familiar: +d.iotm_is_familiar // Convert to number (1 = familiar, other = regular)
            };
        }).sort((a, b) => a.date - b.date); // Ensure dates are sorted

        // Create the chart with both datasets
        createChart(rateData, itemData);

        // Redraw the chart on window resize
        let lastWidth = window.innerWidth;
        window.addEventListener('resize', function () {
            const currentWidth = window.innerWidth;

            // Only redraw when width changes
            if (currentWidth !== lastWidth) {
                // Clear the previous chart
                document.getElementById("chart").innerHTML = '<div class="loading">Resizing chart...</div>';
                // Redraw with updated dimensions
                setTimeout(function () {
                    createChart(rateData, itemData);
                }, 250); // Small delay to prevent constant redraws during resize

                lastWidth = currentWidth;
            }
        });
    }).catch(function (error) {
        // Handle any errors that occur during loading
        console.error("Error loading the data:", error);
        document.getElementById("chart").innerHTML =
            `<div class="error">
        <p>Error loading data. Please try again later.</p>
        </div>`;
    });
}

// Determine if dark mode is enabled
function isDarkMode() {
    // Get the component by selector
    const component = document.querySelector('[x-data]').__x;
    return component.$data.darkMode;
}
