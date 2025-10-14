#include <stdio.h>
#include <emscripten/emscripten.h>

int main() {
    printf("Fake ls: file1.txt\nfile2.txt\nfile3.txt\n");
    return 0;
}
