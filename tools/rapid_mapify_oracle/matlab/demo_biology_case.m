% demo_biology_case  Run the biology RF1 benchmark in MATLAB.
root = fileparts(fileparts(mfilename('fullpath')));
casePath = fullfile(root, 'fixtures', 'cases', 'biology_expand_animals.case.json');
report = evaluateRapidCase(casePath);
disp(report)

% Compare with the good candidate:
goodPath = fullfile(root, 'fixtures', 'biology', 'm3e_good_delta.json');
goodReport = evaluateRapidCase(casePath, goodPath);
disp(goodReport)
