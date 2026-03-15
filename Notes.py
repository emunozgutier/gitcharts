
# Online Python - IDE, Editor, Compiler, Interpreter
@dataclass
def FileLinesPreserved:
    filename: Str 
    filelines: List[Str]



def main():
    data: Dict(date, List[FileLinesPreserved]) = {}
    for i in range(length(time_point_list)):
        date0 = get_date(time_point_list[i])
        allFilesOnDate0 = get_all_files(date0)
        data[date0] = get_all_file_lines(date0) 
        if i > 0:
            currentFiles = list(map(lambda x: x.filename), data[date0])
            for previousFileLinesPreservedList in data[previousDate]:
                for previousFileLinesPerserved in previousFileLinesPreservedList:
                    fileName = previousFileLinesPerserved.filename
                    if fileName in currentFiles:
                        currentFileLinePreserved = filter(lambda x: x.filename == fileName, data[date0])[0]
                        currentFileLinePreserved = GitBlame.get_file_lines_preserved(previousFileLinesPerserved, currentFileLinePreserved)
                    
        previousDate = date0


def GetFilesLinesTahtSurvivedOnEachPeriod(periodFileLinesList):
    dataToPlot: = {}
    for currentPeriodIndex in range(1, len(periodFileLinesList)):
        currentPeriod = periodFileLinesList[currentPeriodIndex]
        dataToPlot[currentPeriod] = {}
        for previousPeriod in range(0, currentPeriodIndex):
            dataToPlot[currentPeriod][previousPeriod] = 0
            fileCurrentPeriod = getFile(fileName, period1)
            for fileName in getFiles(previousPeriod):
                filePreviousPeriod = getFile(fileName, period0)
                count, linesLeft = GetLinesThatSurvived(file0, file1)
