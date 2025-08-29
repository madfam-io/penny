#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Coverage utilities
class CoverageManager {
  constructor() {
    this.coverageDir = path.join(process.cwd(), 'coverage');
    this.thresholds = require('../coverage.config.js').coverageThreshold;
  }

  // Merge multiple coverage reports
  mergeCoverageReports() {
    console.log('🔄 Merging coverage reports...');
    
    try {
      // Create merged coverage directory
      const mergedDir = path.join(this.coverageDir, 'merged');
      if (!fs.existsSync(mergedDir)) {
        fs.mkdirSync(mergedDir, { recursive: true });
      }

      // Find all coverage JSON files
      const coverageFiles = [];
      const findCoverageFiles = (dir) => {
        if (!fs.existsSync(dir)) return;
        
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            findCoverageFiles(fullPath);
          } else if (item === 'coverage.json') {
            coverageFiles.push(fullPath);
          }
        });
      };

      findCoverageFiles(this.coverageDir);

      if (coverageFiles.length === 0) {
        console.warn('⚠️  No coverage files found to merge');
        return;
      }

      // Use nyc to merge coverage reports
      const nycCmd = `npx nyc merge ${this.coverageDir} ${path.join(mergedDir, 'coverage.json')}`;
      execSync(nycCmd, { stdio: 'inherit' });

      // Generate merged reports
      const reportCmd = `npx nyc report --reporter=html --reporter=lcov --reporter=text-summary --temp-dir=${mergedDir} --report-dir=${mergedDir}`;
      execSync(reportCmd, { stdio: 'inherit' });

      console.log('✅ Coverage reports merged successfully');
    } catch (error) {
      console.error('❌ Error merging coverage reports:', error.message);
      process.exit(1);
    }
  }

  // Check coverage thresholds
  checkCoverageThresholds() {
    console.log('🎯 Checking coverage thresholds...');
    
    try {
      const summaryPath = path.join(this.coverageDir, 'merged', 'coverage-summary.json');
      if (!fs.existsSync(summaryPath)) {
        console.error('❌ Coverage summary not found. Run coverage first.');
        process.exit(1);
      }

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      const total = summary.total;

      console.log('\n📊 Current Coverage:');
      console.log(`Lines: ${total.lines.pct}%`);
      console.log(`Functions: ${total.functions.pct}%`);
      console.log(`Branches: ${total.branches.pct}%`);
      console.log(`Statements: ${total.statements.pct}%`);

      // Check global thresholds
      const globalThresholds = this.thresholds.global;
      let failed = false;

      if (total.lines.pct < globalThresholds.lines) {
        console.error(`❌ Line coverage ${total.lines.pct}% below threshold ${globalThresholds.lines}%`);
        failed = true;
      }

      if (total.functions.pct < globalThresholds.functions) {
        console.error(`❌ Function coverage ${total.functions.pct}% below threshold ${globalThresholds.functions}%`);
        failed = true;
      }

      if (total.branches.pct < globalThresholds.branches) {
        console.error(`❌ Branch coverage ${total.branches.pct}% below threshold ${globalThresholds.branches}%`);
        failed = true;
      }

      if (total.statements.pct < globalThresholds.statements) {
        console.error(`❌ Statement coverage ${total.statements.pct}% below threshold ${globalThresholds.statements}%`);
        failed = true;
      }

      if (failed) {
        console.error('\n❌ Coverage thresholds not met!');
        process.exit(1);
      } else {
        console.log('\n✅ All coverage thresholds met!');
      }

    } catch (error) {
      console.error('❌ Error checking coverage thresholds:', error.message);
      process.exit(1);
    }
  }

  // Generate coverage badge
  generateCoverageBadge() {
    console.log('🏷️  Generating coverage badge...');
    
    try {
      const summaryPath = path.join(this.coverageDir, 'merged', 'coverage-summary.json');
      if (!fs.existsSync(summaryPath)) {
        console.error('❌ Coverage summary not found');
        return;
      }

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      const coverage = summary.total.lines.pct;

      // Determine badge color based on coverage
      let color = 'red';
      if (coverage >= 90) color = 'brightgreen';
      else if (coverage >= 80) color = 'green';
      else if (coverage >= 70) color = 'yellow';
      else if (coverage >= 60) color = 'orange';

      // Generate badge URL
      const badgeUrl = `https://img.shields.io/badge/coverage-${coverage}%25-${color}`;
      
      // Create badge markdown
      const badgeMarkdown = `![Coverage](${badgeUrl})`;
      
      // Save badge info
      const badgeInfo = {
        url: badgeUrl,
        markdown: badgeMarkdown,
        coverage: coverage,
        color: color,
        timestamp: new Date().toISOString(),
      };

      fs.writeFileSync(
        path.join(this.coverageDir, 'badge.json'),
        JSON.stringify(badgeInfo, null, 2)
      );

      console.log(`✅ Coverage badge generated: ${coverage}% (${color})`);
    } catch (error) {
      console.error('❌ Error generating coverage badge:', error.message);
    }
  }

  // Generate markdown coverage report
  generateMarkdownReport() {
    console.log('📝 Generating markdown coverage report...');
    
    try {
      const summaryPath = path.join(this.coverageDir, 'merged', 'coverage-summary.json');
      if (!fs.existsSync(summaryPath)) {
        console.error('❌ Coverage summary not found');
        return;
      }

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      
      let markdown = '# Test Coverage Report\n\n';
      markdown += `Generated: ${new Date().toLocaleDateString()}\n\n`;
      
      // Overall coverage
      markdown += '## Overall Coverage\n\n';
      markdown += '| Metric | Coverage | Threshold | Status |\n';
      markdown += '|--------|----------|-----------|--------|\n';
      
      const global = this.thresholds.global;
      const total = summary.total;
      
      const addRow = (metric, current, threshold) => {
        const status = current >= threshold ? '✅' : '❌';
        return `| ${metric} | ${current}% | ${threshold}% | ${status} |\n`;
      };
      
      markdown += addRow('Lines', total.lines.pct, global.lines);
      markdown += addRow('Functions', total.functions.pct, global.functions);
      markdown += addRow('Branches', total.branches.pct, global.branches);
      markdown += addRow('Statements', total.statements.pct, global.statements);
      
      // File-level coverage
      markdown += '\n## File Coverage\n\n';
      
      // Sort files by coverage (lowest first)
      const files = Object.entries(summary)
        .filter(([key]) => key !== 'total')
        .sort(([,a], [,b]) => a.lines.pct - b.lines.pct);
      
      if (files.length > 0) {
        markdown += '| File | Lines | Functions | Branches | Statements |\n';
        markdown += '|------|-------|-----------|----------|-----------|\n';
        
        files.forEach(([file, stats]) => {
          const relativePath = path.relative(process.cwd(), file);
          markdown += `| ${relativePath} | ${stats.lines.pct}% | ${stats.functions.pct}% | ${stats.branches.pct}% | ${stats.statements.pct}% |\n`;
        });
      }
      
      // Uncovered lines
      const uncoveredFiles = files.filter(([,stats]) => stats.lines.pct < 100);
      if (uncoveredFiles.length > 0) {
        markdown += '\n## Files Needing Attention\n\n';
        markdown += 'Files with coverage below 100%:\n\n';
        
        uncoveredFiles.slice(0, 10).forEach(([file, stats]) => {
          const relativePath = path.relative(process.cwd(), file);
          markdown += `- **${relativePath}**: ${stats.lines.pct}% lines covered\n`;
        });
        
        if (uncoveredFiles.length > 10) {
          markdown += `\n... and ${uncoveredFiles.length - 10} more files\n`;
        }
      }
      
      // Save markdown report
      fs.writeFileSync(
        path.join(this.coverageDir, 'README.md'),
        markdown
      );
      
      console.log('✅ Markdown coverage report generated');
    } catch (error) {
      console.error('❌ Error generating markdown report:', error.message);
    }
  }

  // Clean coverage data
  cleanCoverage() {
    console.log('🧹 Cleaning coverage data...');
    
    if (fs.existsSync(this.coverageDir)) {
      fs.rmSync(this.coverageDir, { recursive: true, force: true });
      console.log('✅ Coverage data cleaned');
    }
  }

  // Run all coverage tasks
  runAll() {
    this.mergeCoverageReports();
    this.checkCoverageThresholds();
    this.generateCoverageBadge();
    this.generateMarkdownReport();
  }
}

// CLI interface
const command = process.argv[2];
const coverageManager = new CoverageManager();

switch (command) {
  case 'merge':
    coverageManager.mergeCoverageReports();
    break;
  case 'check':
    coverageManager.checkCoverageThresholds();
    break;
  case 'badge':
    coverageManager.generateCoverageBadge();
    break;
  case 'markdown':
    coverageManager.generateMarkdownReport();
    break;
  case 'clean':
    coverageManager.cleanCoverage();
    break;
  case 'all':
    coverageManager.runAll();
    break;
  default:
    console.log('Usage: node scripts/coverage.js <command>');
    console.log('Commands:');
    console.log('  merge     - Merge coverage reports');
    console.log('  check     - Check coverage thresholds');
    console.log('  badge     - Generate coverage badge');
    console.log('  markdown  - Generate markdown report');
    console.log('  clean     - Clean coverage data');
    console.log('  all       - Run all coverage tasks');
    process.exit(1);
}